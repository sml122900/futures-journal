// 월간 리포트 자동 생성 Cron (매월 1일 23:00 KST = UTC 14:00)
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getDecryptedCredentials, bitgetRequest } from "@/lib/bitget";
import { computeStats } from "@/lib/stats";
import { MONTHLY_REPORT_SYSTEM, buildWeeklyReportPrompt } from "@/lib/ai-prompts";

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? new URL(req.url).searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  let generated = 0;
  let errors = 0;

  try {
    const users = await prisma.user.findMany({
      where: { apiKeys: { some: {} } },
      select: { id: true, subscription: { select: { plan: true } } },
    });

    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const now = Date.now();
    const monthStart = now - MONTH_MS;

    for (const user of users) {
      try {
        const plan = user.subscription?.plan ?? "free";
        // 월간 리포트는 pro 이상에게만 자동 생성
        if (plan === "free") continue;

        const existing = await prisma.aIReport.findFirst({
          where: { userId: user.id, type: "monthly_report", createdAt: { gte: new Date(monthStart) } },
        });
        if (existing) continue;

        const credentials = await getDecryptedCredentials(user.id);
        if (!credentials) continue;

        const allPositions: Record<string, unknown>[] = [];
        let idLessThan: string | undefined;
        for (let page = 0; page < 3; page++) {
          const params: Record<string, string> = {
            productType: "USDT-FUTURES", limit: "100",
            startTime: String(monthStart), endTime: String(now),
          };
          if (idLessThan) params.idLessThan = idLessThan;
          const res = await bitgetRequest(credentials, "GET", "/api/v2/mix/position/history-position", params);
          const list = res?.data?.list ?? [];
          if (!list.length) break;
          allPositions.push(...list);
          if (list.length < 100) break;
          idLessThan = (list[list.length - 1] as Record<string, string>).positionId;
        }
        if (!allPositions.length) continue;

        const memos = await prisma.memo.findMany({ where: { userId: user.id }, select: { positionId: true, reason: true, exitReason: true, psych: true, external: true, text: true } });
        const stats = computeStats(allPositions as unknown as Parameters<typeof computeStats>[0], memos);

        const periodStr = {
          start: new Date(monthStart).toISOString().slice(0, 10),
          end:   new Date(now).toISOString().slice(0, 10),
        };

        const prompt = buildWeeklyReportPrompt({
          period: periodStr, summary: stats.summary,
          patternMatrix: stats.patternMatrix, timeHeatmap: stats.timeHeatmap,
          symbolStats: stats.symbolStats, violations: [], memoSamples: [],
        });

        const msg = await client.messages.create({
          model: "claude-sonnet-4-6", max_tokens: 2048,
          system: MONTHLY_REPORT_SYSTEM,
          messages: [{ role: "user", content: prompt }],
        });
        const reportContent = JSON.parse((msg.content[0] as { type: string; text: string }).text.trim());

        await prisma.aIReport.create({
          data: { userId: user.id, type: "monthly_report", periodStart: new Date(monthStart), periodEnd: new Date(now), content: reportContent },
        });

        generated++;
      } catch (userErr) {
        console.error(`[cron/monthly-reports] userId=${user.id}`, userErr);
        errors++;
      }
    }

    return NextResponse.json({ success: true, generated, errors });
  } catch (error) {
    console.error("[cron/monthly-reports]", error);
    return NextResponse.json({ success: false, message: "Cron 실행 실패" }, { status: 500 });
  }
}
