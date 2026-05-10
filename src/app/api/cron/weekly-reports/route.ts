// 주간 리포트 자동 생성 Cron (매주 일요일 23:00, CRON_SECRET으로 보호)
// Vercel Cron: vercel.json에서 "0 23 * * 0" 스케줄 등록 필요
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getDecryptedCredentials, bitgetRequest } from "@/lib/bitget";
import { computeStats } from "@/lib/stats";
import { WEEKLY_REPORT_SYSTEM, buildWeeklyReportPrompt } from "@/lib/ai-prompts";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  // CRON_SECRET 인증
  const secret = req.headers.get("x-cron-secret") ?? new URL(req.url).searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  let generated = 0;
  let errors = 0;

  try {
    // API 키가 있는 활성 사용자 목록
    const users = await prisma.user.findMany({
      where: { apiKeys: { some: {} } },
      select: { id: true, credits: true },
    });

    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const now = Date.now();
    const weekStart = now - WEEK_MS;

    for (const user of users) {
      try {
        // 이번 주 이미 생성된 리포트가 있으면 건너뜀
        const existing = await prisma.aIReport.findFirst({
          where: { userId: user.id, type: "weekly_report", createdAt: { gte: new Date(weekStart) } },
        });
        if (existing) continue;

        const credentials = await getDecryptedCredentials(user.id);
        if (!credentials) continue;

        const posRes = await bitgetRequest(credentials, "GET", "/api/v2/mix/position/history-position", {
          productType: "USDT-FUTURES", limit: "100",
          startTime: String(weekStart), endTime: String(now),
        });
        const positions = posRes?.data?.list ?? [];
        if (!positions.length) continue;

        const memos = await prisma.memo.findMany({
          where: { userId: user.id },
          select: { positionId: true, reason: true, exitReason: true, psych: true, external: true, text: true },
        });

        const violations = await prisma.ruleViolation.findMany({
          where: { userId: user.id, detectedAt: { gte: new Date(weekStart) } },
          select: { ruleType: true },
        });
        const violationCounts = violations.reduce<Record<string, number>>((acc, v) => {
          acc[v.ruleType] = (acc[v.ruleType] ?? 0) + 1;
          return acc;
        }, {});

        const stats = computeStats(positions, memos);
        const prompt = buildWeeklyReportPrompt({
          period: { start: new Date(weekStart).toISOString().slice(0, 10), end: new Date(now).toISOString().slice(0, 10) },
          summary: stats.summary,
          patternMatrix: stats.patternMatrix,
          timeHeatmap: stats.timeHeatmap,
          symbolStats: stats.symbolStats,
          violations: Object.entries(violationCounts).map(([ruleType, count]) => ({ ruleType, count })),
          memoSamples: [],
        });

        const msg = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          system: WEEKLY_REPORT_SYSTEM,
          messages: [{ role: "user", content: prompt }],
        });
        const reportContent = JSON.parse((msg.content[0] as { type: string; text: string }).text.trim());

        await prisma.aIReport.create({
          data: {
            userId: user.id, type: "weekly_report",
            periodStart: new Date(weekStart), periodEnd: new Date(now),
            content: reportContent,
          },
        });

        generated++;
      } catch (userErr) {
        console.error(`[cron/weekly-reports] userId=${user.id}`, userErr);
        errors++;
      }
    }

    return NextResponse.json({ success: true, generated, errors });
  } catch (error) {
    console.error("[cron/weekly-reports]", error);
    return NextResponse.json({ success: false, message: "Cron 실행 실패" }, { status: 500 });
  }
}
