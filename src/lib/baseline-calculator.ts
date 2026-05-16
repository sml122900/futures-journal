// 사용자 매매 베이스라인(평균 패턴) 계산 라이브러리
import prisma from "@/lib/prisma";
import { createExchangeForUser } from "@/lib/exchanges";
import type { ExchangeId } from "@/lib/exchanges";
import type { UserBaseline } from "@prisma/client";

function average(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// KST 시간대별 손실 비율 60% 이상인 시간(0-23) 목록
function findRiskyHours(positions: Array<{ openTimeMs: number; profit: number }>): number[] {
  const stats: Record<number, { total: number; losses: number }> = {};
  for (const p of positions) {
    const hour = new Date(p.openTimeMs + 9 * 3600_000).getUTCHours();
    if (!stats[hour]) stats[hour] = { total: 0, losses: 0 };
    stats[hour].total++;
    if (p.profit < 0) stats[hour].losses++;
  }
  return Object.entries(stats)
    .filter(([, s]) => s.total >= 3 && s.losses / s.total >= 0.6)
    .map(([h]) => parseInt(h));
}

// KST 요일별 손실 비율 60% 이상인 요일(0=일, 6=토) 목록
function findRiskyDays(positions: Array<{ openTimeMs: number; profit: number }>): number[] {
  const stats: Record<number, { total: number; losses: number }> = {};
  for (const p of positions) {
    const day = new Date(p.openTimeMs + 9 * 3600_000).getUTCDay();
    if (!stats[day]) stats[day] = { total: 0, losses: 0 };
    stats[day].total++;
    if (p.profit < 0) stats[day].losses++;
  }
  return Object.entries(stats)
    .filter(([, s]) => s.total >= 3 && s.losses / s.total >= 0.6)
    .map(([d]) => parseInt(d));
}

// 가장 최근 거래일 기준 연속 흑자 일수
function calculateProfitStreak(positions: Array<{ closeTimeMs: number; profit: number }>): number {
  const dailyPnl: Record<string, number> = {};
  for (const p of positions) {
    const kstDate = new Date(p.closeTimeMs + 9 * 3600_000).toISOString().slice(0, 10);
    dailyPnl[kstDate] = (dailyPnl[kstDate] ?? 0) + p.profit;
  }
  const tradingDays = Object.keys(dailyPnl).sort().reverse();
  let streak = 0;
  for (const day of tradingDays) {
    if (dailyPnl[day] > 0) streak++;
    else break;
  }
  return streak;
}

/**
 * 사용자의 최근 30일 종료 포지션을 분석해 UserBaseline upsert.
 * sampleSize < 5이면 null 반환 (신규 사용자 보호).
 */
export async function recalculateBaseline(
  userId: string,
  exchange: string
): Promise<UserBaseline | null> {
  const inst = await createExchangeForUser(userId, exchange as ExchangeId);
  if (!inst) return null;

  const endTime = Date.now();
  const startTime = endTime - 30 * 24 * 3600_000;

  let rawPositions;
  try {
    rawPositions = await inst.getClosedPositions({ startTime, endTime, limit: 200 });
  } catch {
    return null;
  }

  // Bitget: marginSize, openTime(ms), cTime(ms), netProfit
  // Binance: initialMargin, openTimeStamp(ms), cTime(ms), netProfit
  const positions = rawPositions
    .map((p) => {
      const size = parseFloat(String(p.marginSize ?? p.initialMargin ?? 0));
      const profit = parseFloat(String(p.netProfit ?? p.totalProfits ?? 0));
      const openTimeMs = parseInt(String(p.openTime ?? p.openTimeStamp ?? p.cTime ?? 0));
      const closeTimeMs = parseInt(String(p.closeTime ?? p.cTime ?? 0));
      return { size, profit, openTimeMs, closeTimeMs, roi: size > 0 ? profit / size : 0 };
    })
    .filter((p) => p.size > 0 && p.closeTimeMs > 0);

  if (positions.length < 5) return null;

  return prisma.userBaseline.upsert({
    where: { userId_exchange: { userId, exchange } },
    create: {
      userId,
      exchange,
      avgPositionSize:    average(positions.map((p) => p.size)),
      medianPositionSize: median(positions.map((p) => p.size)),
      avgRoi:             average(positions.map((p) => p.roi)),
      consecutiveProfitDays: calculateProfitStreak(positions),
      riskyHours:         findRiskyHours(positions),
      riskyDaysOfWeek:    findRiskyDays(positions),
      sampleSize:         positions.length,
    },
    update: {
      avgPositionSize:    average(positions.map((p) => p.size)),
      medianPositionSize: median(positions.map((p) => p.size)),
      avgRoi:             average(positions.map((p) => p.roi)),
      consecutiveProfitDays: calculateProfitStreak(positions),
      riskyHours:         findRiskyHours(positions),
      riskyDaysOfWeek:    findRiskyDays(positions),
      sampleSize:         positions.length,
      lastCalculatedAt:   new Date(),
    },
  });
}
