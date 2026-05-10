// 리스크 룰 감지 엔진 (포지션 vs 활성 룰 검사 + 위반 기록)
import prisma from "./prisma";
import { bitgetRequest, BitgetCredentials } from "./bitget";
import type {
  TimeBlockConfig, CooldownConfig, DailyLimitConfig,
  PsychBlockConfig, LiqDistanceConfig, LossStreakConfig,
} from "./rules-types";
import type { TradingRule } from "@prisma/client";

/** 비트겟 오픈 포지션 (all-position API 응답 항목) */
export interface BitgetPosition {
  positionId?: string;
  symbol: string;
  holdSide: string;
  openAvgPrice: string;
  liquidationPrice?: string;
  liqPx?: string;
  openTime?: string;
  ctime?: string;
  leverage?: string;
  marginSize?: string;
}

/** 포지션 ID 결정 (positionId 없으면 복합키 사용) */
function resolvePositionId(p: BitgetPosition): string {
  return p.positionId || `${p.symbol}_${p.holdSide}_${p.openTime || p.ctime || "unknown"}`;
}

// ── 순수 검사 함수 (각 룰 타입별) ───────────────────────────────────────────

/**
 * time_block: 포지션 진입 시각의 UTC hour가 차단 목록에 포함되는지 확인
 */
export function checkTimeBlock(config: TimeBlockConfig, position: BitgetPosition): boolean {
  const ts = parseInt(position.openTime || position.ctime || "0");
  if (!ts) return false;
  const hour = new Date(ts).getUTCHours();
  return config.hours.includes(hour);
}

/**
 * cooldown: 직전 종료 포지션(또는 손실 포지션)으로부터 쿨다운이 경과하지 않은지 확인
 * @param recentHistory 최근 종료 포지션 2개 이상 (closeTime 내림차순)
 */
export function checkCooldown(
  config: CooldownConfig,
  position: BitgetPosition,
  recentHistory: Array<{ netProfit: string; closeTime: string }>
): boolean {
  const posOpenTime = parseInt(position.openTime || position.ctime || "0");
  if (!posOpenTime || !recentHistory.length) return false;

  const target = config.after === "loss"
    ? recentHistory.find((h) => parseFloat(h.netProfit || "0") < 0)
    : recentHistory[0];

  if (!target) return false;

  const lastClose = parseInt(target.closeTime || "0");
  if (!lastClose) return false;

  const elapsed = posOpenTime - lastClose;
  return elapsed >= 0 && elapsed < config.minutes * 60 * 1000;
}

/**
 * daily_limit: 오늘 누적 손실이 마진 대비 설정 % 초과인지 확인
 * @param todayHistory 오늘 종료된 포지션 목록
 */
export function checkDailyLimit(
  config: DailyLimitConfig,
  todayHistory: Array<{ netProfit: string; marginSize: string }>
): boolean {
  if (!todayHistory.length) return false;

  let totalPnl = 0;
  let totalMargin = 0;
  for (const h of todayHistory) {
    totalPnl += parseFloat(h.netProfit || "0");
    totalMargin += parseFloat(h.marginSize || "0");
  }

  if (totalPnl >= 0 || totalMargin <= 0) return false;
  const lossRatio = Math.abs(totalPnl) / totalMargin * 100;
  return lossRatio > config.lossPercent;
}

/**
 * psych_block: 사용자의 가장 최근 메모 심리가 차단 목록에 있는지 확인
 */
export function checkPsychBlock(config: PsychBlockConfig, lastPsych: string): boolean {
  if (!lastPsych) return false;
  return config.blockedStates.some(
    (state) => lastPsych.includes(state) || state.includes(lastPsych)
  );
}

/**
 * liq_distance: 청산가와 진입가의 거리가 최소 % 미만인지 확인
 */
export function checkLiqDistance(config: LiqDistanceConfig, position: BitgetPosition): boolean {
  const entry = parseFloat(position.openAvgPrice || "0");
  const liq = parseFloat(position.liquidationPrice || position.liqPx || "0");
  if (!entry || !liq) return false;

  const distancePct = Math.abs(entry - liq) / entry * 100;
  return distancePct < config.minPercent;
}

/**
 * loss_streak: 최근 N개 포지션이 전부 손실이고 마지막 손실 후 restMinutes 미경과인지 확인
 * @param recentHistory 최근 종료 포지션 (closeTime 내림차순)
 */
export function checkLossStreak(
  config: LossStreakConfig,
  position: BitgetPosition,
  recentHistory: Array<{ netProfit: string; closeTime: string }>
): boolean {
  if (recentHistory.length < config.count) return false;

  const last = recentHistory.slice(0, config.count);
  const allLoss = last.every((h) => parseFloat(h.netProfit || "0") < 0);
  if (!allLoss) return false;

  const posOpenTime = parseInt(position.openTime || position.ctime || "0");
  const lastCloseTime = parseInt(last[0].closeTime || "0");
  if (!posOpenTime || !lastCloseTime) return true; // 시각 불명 → 위반으로 처리

  const elapsed = posOpenTime - lastCloseTime;
  return elapsed >= 0 && elapsed < config.restMinutes * 60 * 1000;
}

// ── 오케스트레이터 ───────────────────────────────────────────────────────────

/**
 * 사용자의 활성 룰 목록 조회
 */
export async function getActiveRules(userId: string): Promise<TradingRule[]> {
  return prisma.tradingRule.findMany({
    where: { userId, enabled: true },
  });
}

/**
 * 룰 감지에 필요한 공통 데이터 한 번에 패치
 * (cooldown, daily_limit, loss_streak 룰이 모두 포지션 히스토리를 사용하므로 공유)
 */
async function fetchRuleContext(
  credentials: BitgetCredentials,
  userId: string,
  rules: TradingRule[]
) {
  const needsHistory = rules.some((r) =>
    ["cooldown", "daily_limit", "loss_streak"].includes(r.type)
  );
  const needsPsych = rules.some((r) => r.type === "psych_block");

  const now = Date.now();
  const todayMidnight = new Date();
  todayMidnight.setUTCHours(0, 0, 0, 0);

  let recentHistory: Array<{ netProfit: string; closeTime: string; marginSize: string }> = [];

  if (needsHistory) {
    // 최근 30일 종료 포지션 (최대 100개), 쿨다운·연속손실·일일한도 공용
    const res = await bitgetRequest(credentials, "GET", "/api/v2/mix/position/history-position", {
      productType: "USDT-FUTURES",
      limit: "100",
      startTime: String(now - 30 * 24 * 60 * 60 * 1000),
      endTime: String(now),
    });
    recentHistory = (res?.data?.list ?? []) as typeof recentHistory;
  }

  // 오늘(UTC) 종료 포지션만 필터
  const todayHistory = recentHistory.filter((h) => {
    const t = parseInt((h as Record<string, string>).closeTime || "0");
    return t >= todayMidnight.getTime();
  });

  let lastPsych = "";
  if (needsPsych) {
    const memo = await prisma.memo.findFirst({
      where: { userId, psych: { not: "" } },
      orderBy: { updatedAt: "desc" },
      select: { psych: true },
    });
    lastPsych = memo?.psych ?? "";
  }

  return { recentHistory, todayHistory, lastPsych };
}

/**
 * 단일 포지션에 대해 모든 활성 룰을 검사하고 위반된 룰 목록 반환
 */
function evaluateRules(
  rules: TradingRule[],
  position: BitgetPosition,
  ctx: {
    recentHistory: Array<{ netProfit: string; closeTime: string; marginSize: string }>;
    todayHistory: Array<{ netProfit: string; closeTime: string; marginSize: string }>;
    lastPsych: string;
  }
): TradingRule[] {
  const violated: TradingRule[] = [];

  for (const rule of rules) {
    const cfg = rule.config as Record<string, unknown>;
    let isViolation = false;

    switch (rule.type) {
      case "time_block":
        isViolation = checkTimeBlock(cfg as unknown as TimeBlockConfig, position);
        break;
      case "cooldown":
        isViolation = checkCooldown(cfg as unknown as CooldownConfig, position, ctx.recentHistory);
        break;
      case "daily_limit":
        isViolation = checkDailyLimit(cfg as unknown as DailyLimitConfig, ctx.todayHistory);
        break;
      case "psych_block":
        isViolation = checkPsychBlock(cfg as unknown as PsychBlockConfig, ctx.lastPsych);
        break;
      case "liq_distance":
        isViolation = checkLiqDistance(cfg as unknown as LiqDistanceConfig, position);
        break;
      case "loss_streak":
        isViolation = checkLossStreak(cfg as unknown as LossStreakConfig, position, ctx.recentHistory);
        break;
    }

    if (isViolation) violated.push(rule);
  }

  return violated;
}

/**
 * 위반 기록 저장 (@@unique([ruleId, positionId])로 중복 방지)
 */
export async function recordViolations(
  userId: string,
  violations: { rule: TradingRule; positionId: string }[]
): Promise<void> {
  if (!violations.length) return;

  await prisma.ruleViolation.createMany({
    data: violations.map(({ rule, positionId }) => ({
      userId,
      ruleId: rule.id,
      positionId,
      ruleType: rule.type,
      ruleConfig: rule.config as object,
    })),
    skipDuplicates: true,
  });
}

/**
 * 현재 오픈 포지션 전체에 대해 활성 룰 검사 + 위반 기록
 * 포지션 API 응답 후 백그라운드에서 호출됨
 */
export async function checkAllPositions(
  userId: string,
  credentials: BitgetCredentials,
  positions: BitgetPosition[]
): Promise<void> {
  if (!positions.length) return;

  const rules = await getActiveRules(userId);
  if (!rules.length) return;

  const ctx = await fetchRuleContext(credentials, userId, rules);

  const toRecord: { rule: TradingRule; positionId: string }[] = [];

  for (const position of positions) {
    const positionId = resolvePositionId(position);
    const violated = evaluateRules(rules, position, ctx);
    for (const rule of violated) {
      toRecord.push({ rule, positionId });
    }
  }

  await recordViolations(userId, toRecord);
}
