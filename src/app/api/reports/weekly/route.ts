// 주간 AI 리포트 생성 / 목록 조회 API
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getDecryptedCredentials, bitgetRequest } from "@/lib/bitget";
import { computeStats } from "@/lib/stats";
import { WEEKLY_REPORT_SYSTEM, buildWeeklyReportPrompt } from "@/lib/ai-prompts";

const REPORT_COST = 30;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** GET /api/reports/weekly — 내 주간 리포트 목록 (최신순) */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const reports = await prisma.aIReport.findMany({
      where: { userId: session.user.id, type: "weekly_report" },
      orderBy: { createdAt: "desc" },
      select: { id: true, periodStart: true, periodEnd: true, content: true, createdAt: true },
    });

    return NextResponse.json({ success: true, data: reports });
  } catch (error) {
    console.error("[reports/weekly GET]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}

/** POST /api/reports/weekly — 새 주간 리포트 생성 (크레딧 30개) */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const userId = session.user.id;

    // 플랜 권한 체크 (premium 이상)
    const { checkFeatureAccess } = await import("@/lib/plans");
    const allowed = await checkFeatureAccess(userId, "ai_reports");
    if (!allowed) {
      return NextResponse.json(
        { success: false, message: "PLAN_REQUIRED", data: { required: "premium" } },
        { status: 403 }
      );
    }

    // 크레딧 확인
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { credits: true } });
    if (!user || user.credits < REPORT_COST) {
      return NextResponse.json(
        { success: false, message: "INSUFFICIENT_CREDITS", data: { required: REPORT_COST, current: user?.credits ?? 0 } },
        { status: 402 }
      );
    }

    // 비트겟 자격증명
    const credentials = await getDecryptedCredentials(userId);
    if (!credentials) {
      return NextResponse.json({ success: false, message: "API 키를 먼저 등록해주세요" }, { status: 400 });
    }

    const now = Date.now();
    const weekStart = now - WEEK_MS;

    // 최근 7일 포지션 내역
    const posRes = await bitgetRequest(credentials, "GET", "/api/v2/mix/position/history-position", {
      productType: "USDT-FUTURES",
      limit: "100",
      startTime: String(weekStart),
      endTime: String(now),
    });
    const positions = posRes?.data?.list ?? [];

    if (!positions.length) {
      return NextResponse.json({ success: false, message: "최근 7일 거래 내역이 없습니다" }, { status: 400 });
    }

    // 메모 조회
    const memos = await prisma.memo.findMany({
      where: { userId },
      select: { positionId: true, reason: true, exitReason: true, psych: true, external: true, text: true },
    });

    // 이번 주 위반 기록
    const violations = await prisma.ruleViolation.findMany({
      where: { userId, detectedAt: { gte: new Date(weekStart) } },
      select: { ruleType: true },
    });
    const violationCounts = violations.reduce<Record<string, number>>((acc, v) => {
      acc[v.ruleType] = (acc[v.ruleType] ?? 0) + 1;
      return acc;
    }, {});
    const violationList = Object.entries(violationCounts).map(([ruleType, count]) => ({ ruleType, count }));

    // 통계 계산
    const stats = computeStats(positions, memos);

    // 메모 샘플 (포지션과 매칭)
    const memoMap = new Map(memos.map((m) => [m.positionId, m]));
    const memoSamples = (positions as Record<string, string>[]).slice(0, 5)
      .map((p) => {
        const m = memoMap.get(p.positionId);
        return m ? { reason: m.reason, psych: m.psych, exitReason: m.exitReason } : null;
      })
      .filter(Boolean) as Array<{ reason: string; psych: string; exitReason: string }>;

    const prompt = buildWeeklyReportPrompt({
      period: { start: new Date(weekStart).toISOString().slice(0, 10), end: new Date(now).toISOString().slice(0, 10) },
      summary: stats.summary,
      patternMatrix: stats.patternMatrix,
      timeHeatmap: stats.timeHeatmap,
      symbolStats: stats.symbolStats,
      violations: violationList,
      memoSamples,
    });

    // Claude API 호출
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: WEEKLY_REPORT_SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = (msg.content[0] as { type: string; text: string }).text.trim();
    const reportContent = JSON.parse(raw);

    const periodStart = new Date(weekStart);
    const periodEnd = new Date(now);

    // 크레딧 차감 + 리포트 저장 (트랜잭션)
    const [report] = await prisma.$transaction([
      prisma.aIReport.create({
        data: { userId, type: "weekly_report", periodStart, periodEnd, content: reportContent },
      }),
      prisma.user.update({ where: { id: userId }, data: { credits: { decrement: REPORT_COST } } }),
      prisma.creditLog.create({ data: { userId, delta: -REPORT_COST, reason: "weekly_report_claude-sonnet-4-6" } }),
    ]);

    return NextResponse.json({ success: true, data: { id: report.id, content: reportContent, createdAt: report.createdAt } });
  } catch (error) {
    console.error("[reports/weekly POST]", error);
    const msg = (error as Error)?.message ?? "";
    if (msg.includes("429") || msg.includes("quota")) {
      return NextResponse.json({ success: false, message: "AI API 한도 초과. 잠시 후 재시도해주세요." }, { status: 429 });
    }
    return NextResponse.json({ success: false, message: "리포트 생성 실패" }, { status: 500 });
  }
}
