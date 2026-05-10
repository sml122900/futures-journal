// 월간 AI 리포트 생성 / 목록 조회 API
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getDecryptedCredentials, bitgetRequest } from "@/lib/bitget";
import { computeStats } from "@/lib/stats";
import { MONTHLY_REPORT_SYSTEM, buildWeeklyReportPrompt } from "@/lib/ai-prompts";

const REPORT_COST = 50;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/** GET /api/reports/monthly — 내 월간 리포트 목록 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const reports = await prisma.aIReport.findMany({
      where: { userId: session.user.id, type: "monthly_report" },
      orderBy: { createdAt: "desc" },
      select: { id: true, periodStart: true, periodEnd: true, content: true, createdAt: true },
    });

    return NextResponse.json({ success: true, data: reports });
  } catch (error) {
    console.error("[reports/monthly GET]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}

/** POST /api/reports/monthly — 새 월간 리포트 생성 (크레딧 50개) */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const userId = session.user.id;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { credits: true } });
    if (!user || user.credits < REPORT_COST) {
      return NextResponse.json(
        { success: false, message: "INSUFFICIENT_CREDITS", data: { required: REPORT_COST, current: user?.credits ?? 0 } },
        { status: 402 }
      );
    }

    const credentials = await getDecryptedCredentials(userId);
    if (!credentials) {
      return NextResponse.json({ success: false, message: "API 키를 먼저 등록해주세요" }, { status: 400 });
    }

    const now = Date.now();
    const monthStart = now - MONTH_MS;

    // 최근 30일 포지션 수집 (최대 2페이지)
    const allPositions: Record<string, unknown>[] = [];
    let idLessThan: string | undefined;
    for (let page = 0; page < 2; page++) {
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

    if (!allPositions.length) {
      return NextResponse.json({ success: false, message: "최근 30일 거래 내역이 없습니다" }, { status: 400 });
    }

    const memos = await prisma.memo.findMany({
      where: { userId },
      select: { positionId: true, reason: true, exitReason: true, psych: true, external: true, text: true },
    });

    const violations = await prisma.ruleViolation.findMany({
      where: { userId, detectedAt: { gte: new Date(monthStart) } },
      select: { ruleType: true },
    });
    const violationCounts = violations.reduce<Record<string, number>>((acc, v) => {
      acc[v.ruleType] = (acc[v.ruleType] ?? 0) + 1;
      return acc;
    }, {});
    const violationList = Object.entries(violationCounts).map(([ruleType, count]) => ({ ruleType, count }));

    const stats = computeStats(
      allPositions as unknown as Parameters<typeof computeStats>[0],
      memos
    );

    const prompt = buildWeeklyReportPrompt({
      period: { start: new Date(monthStart).toISOString().slice(0, 10), end: new Date(now).toISOString().slice(0, 10) },
      summary: stats.summary,
      patternMatrix: stats.patternMatrix,
      timeHeatmap: stats.timeHeatmap,
      symbolStats: stats.symbolStats,
      violations: violationList,
      memoSamples: [],
    });

    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: MONTHLY_REPORT_SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    const reportContent = JSON.parse((msg.content[0] as { type: string; text: string }).text.trim());

    const [report] = await prisma.$transaction([
      prisma.aIReport.create({
        data: { userId, type: "monthly_report", periodStart: new Date(monthStart), periodEnd: new Date(now), content: reportContent },
      }),
      prisma.user.update({ where: { id: userId }, data: { credits: { decrement: REPORT_COST } } }),
      prisma.creditLog.create({ data: { userId, delta: -REPORT_COST, reason: "monthly_report_claude-sonnet-4-6" } }),
    ]);

    return NextResponse.json({ success: true, data: { id: report.id, content: reportContent, createdAt: report.createdAt } });
  } catch (error) {
    console.error("[reports/monthly POST]", error);
    return NextResponse.json({ success: false, message: "리포트 생성 실패" }, { status: 500 });
  }
}
