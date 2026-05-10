// 마일스톤 달성 여부 체크 및 기록
import prisma from "./prisma";
import { type MilestoneType } from "./milestones";

interface PositionLike {
  netProfit: string;
  closeTime?: string;
  openTime?: string;
}

/**
 * 아직 달성하지 않은 마일스톤을 체크하고 달성 시 DB에 저장
 * 포지션 데이터가 갱신될 때 호출
 */
export async function checkAndAwardMilestones(
  userId: string,
  allPositions: PositionLike[]
): Promise<MilestoneType[]> {
  if (!allPositions.length) return [];

  // 이미 달성한 마일스톤 목록
  const existing = await prisma.milestone.findMany({
    where: { userId },
    select: { type: true },
  });
  const achieved = new Set(existing.map((m) => m.type));

  const toAward: MilestoneType[] = [];
  const positions = allPositions.map((p) => ({
    pnl: parseFloat(p.netProfit || "0"),
    closeTime: parseInt(p.closeTime || p.openTime || "0"),
  })).sort((a, b) => b.closeTime - a.closeTime);

  const totalTrades = positions.length;
  const wins = positions.filter((p) => p.pnl > 0).length;

  function check(type: MilestoneType, condition: boolean) {
    if (!achieved.has(type) && condition) toAward.push(type);
  }

  // 거래 수 마일스톤
  check("first_trade",  totalTrades >= 1);
  check("trades_10",    totalTrades >= 10);
  check("trades_100",   totalTrades >= 100);

  // 연승 체크
  let streak = 0;
  for (const p of positions) {
    if (p.pnl > 0) streak++;
    else break;
  }
  check("win_streak_5",  streak >= 5);
  check("win_streak_10", streak >= 10);

  // 주간 흑자 (최근 7일)
  const weekAgo = Date.now() - 7 * 86400000;
  const weekPnl = positions.filter((p) => p.closeTime >= weekAgo).reduce((s, p) => s + p.pnl, 0);
  check("profitable_week", weekPnl > 0 && positions.filter((p) => p.closeTime >= weekAgo).length > 0);

  // 월간 흑자 (최근 30일)
  const monthAgo = Date.now() - 30 * 86400000;
  const monthPositions = positions.filter((p) => p.closeTime >= monthAgo);
  const monthPnl = monthPositions.reduce((s, p) => s + p.pnl, 0);
  check("profitable_month", monthPnl > 0 && monthPositions.length > 0);

  // 월 +10% (총손익 / 총마진 > 10%) — 마진 데이터 없을 경우 단순 5U 이상 흑자
  check("monthly_10_percent", monthPnl >= 10 && wins > 0);

  // 룰 완전 준수 주 (최근 7일 룰 위반 0건 + 거래 1건 이상)
  const weekTrades = positions.filter((p) => p.closeTime >= weekAgo).length;
  if (weekTrades > 0) {
    const weekViolations = await prisma.ruleViolation.count({
      where: { userId, detectedAt: { gte: new Date(weekAgo) } },
    });
    check("rule_compliance_week",      weekViolations === 0);
    check("first_100_rule_compliance", weekViolations === 0);
  }

  if (!toAward.length) return [];

  // 달성 마일스톤 일괄 저장 (skipDuplicates로 race condition 방지)
  await prisma.milestone.createMany({
    data: toAward.map((type) => ({ userId, type })),
    skipDuplicates: true,
  });

  return toAward;
}

/** 사용자의 달성 마일스톤 목록 조회 */
export async function getUserMilestones(userId: string) {
  return prisma.milestone.findMany({
    where: { userId },
    orderBy: { achievedAt: "desc" },
  });
}
