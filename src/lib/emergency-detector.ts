// 뇌동매매 위험 감지 — 포지션 진입 시 Level(0~3) 판단
import prisma from "@/lib/prisma";

export type EmergencyTrigger =
  | "size_multiplier_low"       // 평소 1.5~2배
  | "size_multiplier_mid"       // 평소 2~5배
  | "size_multiplier_high"      // 평소 5배 이상
  | "rest_declared_violated"    // "오늘 쉼" 선언 위반
  | "consecutive_profit_break"  // 7일+ 연속 흑자 중 큰 사이즈
  | "risky_time_window"         // 과거 손실 집중 시간대
  | "risky_day_of_week";        // 과거 손실 집중 요일

export interface EmergencyContext {
  avgSize: number;
  sizeMultiplier: number;
  consecutiveProfitDays: number;
  restDeclaredAt?: Date;
  pastSimilarCount?: number;
  pastSimilarLossAvg?: number;
}

export interface EmergencyDecision {
  level: 0 | 1 | 2 | 3;
  triggers: EmergencyTrigger[];
  context: EmergencyContext;
}

type BaselineRow = Awaited<ReturnType<typeof prisma.userBaseline.findUnique>>;
type SettingRow  = Awaited<ReturnType<typeof prisma.emergencySetting.findUnique>>;
type RestRow     = Awaited<ReturnType<typeof prisma.restDeclaration.findFirst>>;

export type EmergencyPrefetch = {
  baseline: BaselineRow;
  setting:  SettingRow;
  activeRest: RestRow;
};

function decideLevel(triggers: EmergencyTrigger[], thresholds: { l1: number; l2: number; l3: number }, sizeMultiplier: number): 0 | 1 | 2 | 3 {
  if (sizeMultiplier >= thresholds.l3) return 3;
  if (triggers.includes("rest_declared_violated") && triggers.length >= 2) return 3;
  if (sizeMultiplier >= thresholds.l2) return 2;
  if (triggers.includes("rest_declared_violated")) return 2;
  if (triggers.includes("size_multiplier_low") && triggers.length >= 2) return 2;
  if (triggers.includes("size_multiplier_low")) return 1;
  return 0;
}

/**
 * DB 쿼리 없이 위험도 판단 — 미리 조회한 데이터로 순수 계산.
 * route.ts에서 병렬 fetch 후 호출.
 */
export function computeEmergency(
  position: { exchange: string; symbol: string; side: string; size: number; openedAt: number },
  { baseline, setting, activeRest }: EmergencyPrefetch
): EmergencyDecision {
  const empty: EmergencyDecision = { level: 0, triggers: [], context: { avgSize: 0, sizeMultiplier: 0, consecutiveProfitDays: 0 } };

  if (!baseline || baseline.sampleSize < 5) return empty;

  const thresholds = {
    l1: setting?.level1Threshold ?? 1.5,
    l2: setting?.level2Threshold ?? 2.0,
    l3: setting?.level3Threshold ?? 5.0,
  };

  const referenceSize =
    baseline.medianPositionSize > 0
      ? baseline.medianPositionSize
      : baseline.avgPositionSize * 0.3;
  if (referenceSize <= 0) return empty;

  const sizeMultiplier = position.size / referenceSize;
  const triggers: EmergencyTrigger[] = [];

  if (sizeMultiplier >= thresholds.l3)       triggers.push("size_multiplier_high");
  else if (sizeMultiplier >= thresholds.l2)  triggers.push("size_multiplier_mid");
  else if (sizeMultiplier >= thresholds.l1)  triggers.push("size_multiplier_low");

  if (activeRest) triggers.push("rest_declared_violated");

  if (baseline.consecutiveProfitDays >= 7 && sizeMultiplier >= thresholds.l2) {
    triggers.push("consecutive_profit_break");
  }

  const kstHour = new Date(position.openedAt + 9 * 3600_000).getUTCHours();
  if ((baseline.riskyHours as number[]).includes(kstHour)) triggers.push("risky_time_window");

  const kstDay = new Date(position.openedAt + 9 * 3600_000).getUTCDay();
  if ((baseline.riskyDaysOfWeek as number[]).includes(kstDay)) triggers.push("risky_day_of_week");

  const level = decideLevel(triggers, thresholds, sizeMultiplier);
  if (level === 0) return empty;

  return {
    level,
    triggers,
    context: {
      avgSize: referenceSize,
      sizeMultiplier,
      consecutiveProfitDays: baseline.consecutiveProfitDays,
      restDeclaredAt: activeRest?.declaredAt,
    },
  };
}

/** 단독 호출용 async 래퍼 (route.ts 외 외부 호출 시 사용) */
export async function detectEmergency(
  userId: string,
  position: { exchange: string; symbol: string; side: "long" | "short"; size: number; openedAt: number }
): Promise<EmergencyDecision> {
  const [baseline, setting, activeRest] = await Promise.all([
    prisma.userBaseline.findUnique({ where: { userId_exchange: { userId, exchange: position.exchange } } }),
    prisma.emergencySetting.findUnique({ where: { userId } }),
    prisma.restDeclaration.findFirst({ where: { userId, expiresAt: { gt: new Date() }, cancelledAt: null } }),
  ]);

  const base = computeEmergency(position, { baseline, setting, activeRest });
  if (base.level === 0) return base;

  let pastSimilarCount: number | undefined;
  try {
    const rows = await prisma.emergencyAlertSession.findMany({
      where: { userId, startedAt: { gt: new Date(Date.now() - 90 * 24 * 3600_000) }, userAction: { in: ["kept", "ignored", "user_closing"] } },
      select: { id: true },
    });
    if (rows.length > 0) pastSimilarCount = rows.length;
  } catch { /* 조회 실패해도 발동에는 영향 없음 */ }

  return { ...base, context: { ...base.context, pastSimilarCount } };
}
