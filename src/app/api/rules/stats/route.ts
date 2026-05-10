// 룰 위반 통계 API (이번 달 기준)
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * GET /api/rules/stats
 * 이번 달 위반 통계: 타입별 집계 + 위반/준수 거래 손익 비교
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const userId = session.user.id;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // 이번 달 위반 기록 전체 조회
    const violations = await prisma.ruleViolation.findMany({
      where: { userId, detectedAt: { gte: monthStart } },
    });

    // 타입별 집계
    const typeMap = new Map<string, { count: number; pnlSum: number; pnlCount: number }>();
    for (const v of violations) {
      const prev = typeMap.get(v.ruleType) ?? { count: 0, pnlSum: 0, pnlCount: 0 };
      typeMap.set(v.ruleType, {
        count: prev.count + 1,
        pnlSum: prev.pnlSum + (v.pnlImpact ?? 0),
        pnlCount: prev.pnlCount + (v.pnlImpact !== null ? 1 : 0),
      });
    }

    const byType = Array.from(typeMap.entries()).map(([type, v]) => ({
      type,
      count: v.count,
      totalLoss: parseFloat(v.pnlSum.toFixed(2)),
      avgPnlPercent: v.pnlCount > 0
        ? parseFloat((v.pnlSum / v.pnlCount).toFixed(2))
        : null,
    })).sort((a, b) => b.count - a.count);

    // 위반 거래 평균 손익 (pnlImpact가 기록된 것만)
    const pnlRecords = violations.filter((v) => v.pnlImpact !== null).map((v) => v.pnlImpact!);
    const ruleViolatingPnl = pnlRecords.length > 0
      ? parseFloat((pnlRecords.reduce((a, b) => a + b, 0) / pnlRecords.length).toFixed(2))
      : null;

    return NextResponse.json({
      success: true,
      data: {
        byType,
        ruleViolatingPnl,
        ruleCompliantPnl: null,      // 미구현: 전체 포지션 조회 필요
        improvementPotential: null,  // 미구현: 위반/준수 손익 비교 필요
        totalViolations: violations.length,
        period: { from: monthStart.toISOString(), to: now.toISOString() },
      },
    });
  } catch (error) {
    console.error("[rules/stats GET]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}
