// 6개 사용자 정의 트리거 체크 + TriggerViolation 기록
import prisma from "@/lib/prisma";
import { isInTimeRange } from "@/lib/timezone-utils";

export type TriggerType =
  | "max_total_position"
  | "no_trade_window"
  | "recurring_no_trade"
  | "max_single_loss"
  | "min_interval"
  | "max_single_size";

export interface FiredTrigger {
  type: TriggerType;
  message: string;
  context?: Record<string, unknown>;
}

export interface TriggerDecision {
  level: 0 | 1 | 2 | 3;
  triggers: FiredTrigger[];
  forceSentence: string;
}

export interface OrderInfo {
  exchange: string;
  symbol: string;
  side: string;
  size: number;          // USDT
  unrealizedPnl?: number; // 음수 = 손실
}

/** 현재 포지션 목록 (위험 체크용 최소 구조) */
export interface PositionSummary {
  size: number;
  unrealizedPnl: number;
}

// --- 개별 체커 ---

async function checkMaxTotalPosition(
  userId: string,
  positions: PositionSummary[],
  setting: { maxTotalPositionEnabled: boolean; maxTotalPositionUsdt: number | null }
): Promise<FiredTrigger | null> {
  if (!setting.maxTotalPositionEnabled || !setting.maxTotalPositionUsdt) return null;
  const total = positions.reduce((sum, p) => sum + p.size, 0);
  if (total <= setting.maxTotalPositionUsdt) return null;
  return {
    type: "max_total_position",
    message: `총 포지션 ${total.toFixed(0)} USDT가 한도 ${setting.maxTotalPositionUsdt} USDT 초과`,
    context: { total, limit: setting.maxTotalPositionUsdt },
  };
}

async function checkNoTradeWindow(userId: string): Promise<FiredTrigger | null> {
  const now = new Date();
  const win = await prisma.noTradeWindow.findFirst({
    where: { userId, startAt: { lte: now }, endAt: { gt: now } },
  });
  if (!win) return null;
  const fmt = (d: Date) => {
    const kst = new Date(d.getTime() + 9 * 3600_000);
    return `${String(kst.getUTCMonth() + 1).padStart(2, "0")}/${String(kst.getUTCDate()).padStart(2, "0")} ${String(kst.getUTCHours()).padStart(2, "0")}:${String(kst.getUTCMinutes()).padStart(2, "0")}`;
  };
  return {
    type: "no_trade_window",
    message: `매매 금지 시간 (${fmt(win.startAt)}~${fmt(win.endAt)} KST)${win.reason ? ` — ${win.reason}` : ""}`,
    context: { windowId: win.id },
  };
}

async function checkRecurringNoTrade(userId: string): Promise<FiredTrigger | null> {
  const rules = await prisma.recurringNoTrade.findMany({
    where: { userId, enabled: true },
  });
  const now = new Date();
  for (const r of rules) {
    if (isInTimeRange(now, r.startHour, r.startMin, r.endHour, r.endMin)) {
      const pad = (n: number) => String(n).padStart(2, "0");
      return {
        type: "recurring_no_trade",
        message: `${r.reason ?? "반복 금지 시간대"} (${pad(r.startHour)}:${pad(r.startMin)}~${pad(r.endHour)}:${pad(r.endMin)} KST)`,
        context: { ruleId: r.id },
      };
    }
  }
  return null;
}

async function checkMaxSingleLoss(
  userId: string,
  positions: PositionSummary[],
  setting: { maxSingleLossEnabled: boolean; maxSingleLossUsdt: number | null },
  orderInfo?: OrderInfo
): Promise<FiredTrigger | null> {
  if (!setting.maxSingleLossEnabled || !setting.maxSingleLossUsdt) return null;
  // 진입 시점이면 현재 포지션 체크, 아니면 orderInfo의 pnl 사용
  const lossPositions = positions.filter(p => p.unrealizedPnl < -setting.maxSingleLossUsdt!);
  if (lossPositions.length === 0) {
    if (!orderInfo?.unrealizedPnl || orderInfo.unrealizedPnl >= -setting.maxSingleLossUsdt) return null;
    return {
      type: "max_single_loss",
      message: `포지션 손실 ${Math.abs(orderInfo.unrealizedPnl).toFixed(2)} USDT가 한도 ${setting.maxSingleLossUsdt} USDT 초과`,
      context: { loss: orderInfo.unrealizedPnl, limit: setting.maxSingleLossUsdt },
    };
  }
  const worst = Math.min(...lossPositions.map(p => p.unrealizedPnl));
  return {
    type: "max_single_loss",
    message: `포지션 손실 ${Math.abs(worst).toFixed(2)} USDT가 한도 ${setting.maxSingleLossUsdt} USDT 초과`,
    context: { loss: worst, limit: setting.maxSingleLossUsdt },
  };
}

async function checkMinInterval(
  userId: string,
  setting: { minIntervalEnabled: boolean; minIntervalMinutes: number | null; lastPositionEntryAt: Date | null }
): Promise<FiredTrigger | null> {
  if (!setting.minIntervalEnabled || !setting.minIntervalMinutes) return null;
  if (!setting.lastPositionEntryAt) return null;
  const elapsedMs = Date.now() - new Date(setting.lastPositionEntryAt).getTime();
  const elapsedMin = Math.floor(elapsedMs / 60_000);
  if (elapsedMin >= setting.minIntervalMinutes) return null;
  return {
    type: "min_interval",
    message: `마지막 진입 후 ${elapsedMin}분 경과 (최소 ${setting.minIntervalMinutes}분 필요)`,
    context: { elapsedMin, requiredMin: setting.minIntervalMinutes },
  };
}

function checkMaxSingleSize(
  orderInfo: OrderInfo,
  setting: { maxSingleSizeEnabled: boolean; maxSingleSizeUsdt: number | null }
): FiredTrigger | null {
  if (!setting.maxSingleSizeEnabled || !setting.maxSingleSizeUsdt) return null;
  if (orderInfo.size <= setting.maxSingleSizeUsdt) return null;
  return {
    type: "max_single_size",
    message: `진입 사이즈 ${orderInfo.size.toFixed(0)} USDT가 한도 ${setting.maxSingleSizeUsdt} USDT 초과`,
    context: { size: orderInfo.size, limit: setting.maxSingleSizeUsdt },
  };
}

// --- 메인 함수 ---

/**
 * 모든 트리거 체크. orderInfo 있으면 #5(min_interval)도 체크, #6(max_single_size)도 체크.
 * 발동된 트리거는 TriggerViolation으로 자동 기록.
 */
export async function checkAllTriggers(
  userId: string,
  positions: PositionSummary[],
  source: string,
  orderInfo?: OrderInfo
): Promise<TriggerDecision> {
  const setting = await prisma.userTriggerSettings.findUnique({ where: { userId } });
  if (!setting) return { level: 0, triggers: [], forceSentence: "나는 충동이 아닌 원칙으로 매매할 것을 맹세한다" };

  const [t1, t2, t3, t4, t5] = await Promise.all([
    checkMaxTotalPosition(userId, positions, setting),
    checkNoTradeWindow(userId),
    checkRecurringNoTrade(userId),
    checkMaxSingleLoss(userId, positions, setting, orderInfo),
    checkMinInterval(userId, setting),
  ]);

  const t6 = orderInfo ? checkMaxSingleSize(orderInfo, setting) : null;

  const fired = [t1, t2, t3, t4, t5, t6].filter((t): t is FiredTrigger => t !== null);

  if (fired.length === 0) return { level: 0, triggers: [], forceSentence: setting.forceSentence };

  // 위반 기록 (non-blocking)
  prisma.triggerViolation.createMany({
    data: fired.map(t => ({
      userId,
      triggerType: t.type,
      message:     t.message,
      context:     (t.context ?? null) as object,
      source,
    })),
  }).catch(() => {});

  const count = fired.length;
  const level: 1 | 2 | 3 = count >= 3 ? 3 : count === 2 ? 2 : 1;

  return { level, triggers: fired, forceSentence: setting.forceSentence };
}

/** 상태 기반(#1~#5) 차단 여부만 빠르게 확인 (진입 시점 #6 제외) */
export async function getActiveBlockingReason(
  userId: string,
  positions: PositionSummary[]
): Promise<{ isBlocking: boolean; reasons: string[] }> {
  const decision = await checkAllTriggers(userId, positions, "status-check");
  const stateBased = decision.triggers.filter(t => t.type !== "max_single_size");
  return {
    isBlocking: stateBased.length > 0,
    reasons: stateBased.map(t => t.message),
  };
}

/** min_interval용 마지막 진입 시각 업데이트 */
export async function updateLastPositionEntry(userId: string): Promise<void> {
  await prisma.userTriggerSettings.updateMany({
    where: { userId },
    data:  { lastPositionEntryAt: new Date() },
  });
}
