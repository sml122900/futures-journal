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

function decideLevel(triggers: EmergencyTrigger[], thresholds: { l1: number; l2: number; l3: number }, sizeMultiplier: number): 0 | 1 | 2 | 3 {
  if (sizeMultiplier >= thresholds.l3) return 3;
  if (triggers.includes("rest_declared_violated") && triggers.length >= 2) return 3;
  if (sizeMultiplier >= thresholds.l2) return 2;
  if (triggers.includes("rest_declared_violated")) return 2;
  if (triggers.includes("size_multiplier_low") && triggers.length >= 2) return 2;
  if (triggers.includes("size_multiplier_low")) return 1;
  return 0;
}

export async function detectEmergency(
  userId: string,
  position: {
    exchange: string;
    symbol: string;
    side: "long" | "short";
    size: number;      // USDT 기준 마진
    openedAt: number;  // ms timestamp
  }
): Promise<EmergencyDecision> {
  const empty: EmergencyDecision = { level: 0, triggers: [], context: { avgSize: 0, sizeMultiplier: 0, consecutiveProfitDays: 0 } };

  // 베이스라인 조회
  const baseline = await prisma.userBaseline.findUnique({
    where: { userId_exchange: { userId, exchange: position.exchange } },
  });

  if (!baseline || baseline.sampleSize < 5) return empty;

  // EmergencySetting (커스텀 임계값)
  const setting = await prisma.emergencySetting.findUnique({ where: { userId } });
  const thresholds = {
    l1: setting?.level1Threshold ?? 1.5,
    l2: setting?.level2Threshold ?? 2.0,
    l3: setting?.level3Threshold ?? 5.0,
  };

  // false positive 방지: avg와 median 중 큰 값 기준
  const referenceSize = Math.max(baseline.avgPositionSize, baseline.medianPositionSize);
  if (referenceSize <= 0) return empty;

  const sizeMultiplier = position.size / referenceSize;
  const triggers: EmergencyTrigger[] = [];

  if (sizeMultiplier >= thresholds.l3)       triggers.push("size_multiplier_high");
  else if (sizeMultiplier >= thresholds.l2)  triggers.push("size_multiplier_mid");
  else if (sizeMultiplier >= thresholds.l1)  triggers.push("size_multiplier_low");

  // 휴식 선언 위반
  const activeRest = await prisma.restDeclaration.findFirst({
    where: { userId, expiresAt: { gt: new Date() }, cancelledAt: null },
  });
  if (activeRest) triggers.push("rest_declared_violated");

  // 연속 흑자 + 큰 사이즈
  if (baseline.consecutiveProfitDays >= 7 && sizeMultiplier >= thresholds.l2) {
    triggers.push("consecutive_profit_break");
  }

  // 위험 시간대 (KST)
  const kstHour = new Date(position.openedAt + 9 * 3600_000).getUTCHours();
  if ((baseline.riskyHours as number[]).includes(kstHour)) triggers.push("risky_time_window");

  // 위험 요일 (KST)
  const kstDay = new Date(position.openedAt + 9 * 3600_000).getUTCDay();
  if ((baseline.riskyDaysOfWeek as number[]).includes(kstDay)) triggers.push("risky_day_of_week");

  // level 0이면 조기 반환
  const level = decideLevel(triggers, thresholds, sizeMultiplier);
  if (level === 0) return empty;

  // 과거 유사 패턴 (최근 90일, 평소 1.5배 이상 진입 세션의 결과)
  let pastSimilarCount: number | undefined;
  let pastSimilarLossAvg: number | undefined;
  try {
    const pastSessions = await prisma.emergencyAlertSession.findMany({
      where: {
        userId,
        startedAt: { gt: new Date(Date.now() - 90 * 24 * 3600_000) },
        userAction: { in: ["kept", "ignored", "user_closing"] },
      },
      select: { id: true },
    });
    if (pastSessions.length > 0) {
      pastSimilarCount = pastSessions.length;
      // 손실 데이터는 현재 DB 구조상 직접 조회 어려워 건수만 사용
      pastSimilarLossAvg = undefined;
    }
  } catch { /* 과거 패턴 조회 실패해도 발동에는 영향 없음 */ }

  return {
    level,
    triggers,
    context: {
      avgSize: referenceSize,
      sizeMultiplier,
      consecutiveProfitDays: baseline.consecutiveProfitDays,
      restDeclaredAt: activeRest?.declaredAt,
      pastSimilarCount,
      pastSimilarLossAvg,
    },
  };
}
