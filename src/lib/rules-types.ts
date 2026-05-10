// 리스크 룰 시스템 타입 정의

export type RuleType =
  | "time_block"
  | "cooldown"
  | "daily_limit"
  | "psych_block"
  | "liq_distance"
  | "loss_streak";

// ── 룰별 config 인터페이스 ──────────────────────────────────────────────────

/** 특정 시간대 진입 차단 (0~23시) */
export interface TimeBlockConfig {
  hours: number[];
}

/** 직전 거래 후 쿨다운 (분 단위) */
export interface CooldownConfig {
  minutes: number;
  after: "loss" | "any"; // 손실 후 | 모든 거래 후
}

/** 일일 손실률 한도 (마진 대비 %) */
export interface DailyLimitConfig {
  lossPercent: number;
}

/** 특정 심리 상태일 때 진입 경고 */
export interface PsychBlockConfig {
  blockedStates: string[];
}

/** 청산가 최소 거리 % 미만 시 경고 */
export interface LiqDistanceConfig {
  minPercent: number;
}

/** N연속 손실 후 X분 휴식 없이 재진입 시 경고 */
export interface LossStreakConfig {
  count: number;
  restMinutes: number;
}

/** 룰 타입별 config 유니온 */
export type RuleConfig =
  | TimeBlockConfig
  | CooldownConfig
  | DailyLimitConfig
  | PsychBlockConfig
  | LiqDistanceConfig
  | LossStreakConfig;

// ── 룰 메타 (UI 표시용) ──────────────────────────────────────────────────────

export interface RuleMeta {
  label: string;
  description: string;
  configLabel: string;
}

export const RULE_META: Record<RuleType, RuleMeta> = {
  time_block: {
    label: "시간대 차단",
    description: "설정한 시간대(UTC)에 진입한 포지션을 감지합니다.",
    configLabel: "차단 시간대",
  },
  cooldown: {
    label: "쿨다운",
    description: "직전 거래 후 설정한 시간이 지나기 전 재진입을 감지합니다.",
    configLabel: "쿨다운 시간",
  },
  daily_limit: {
    label: "일일 손실 한도",
    description: "당일 누적 손실이 마진 대비 설정 비율을 초과하면 감지합니다.",
    configLabel: "손실 한도",
  },
  psych_block: {
    label: "심리 상태 경고",
    description: "최근 메모의 심리 상태가 차단 목록에 있을 때 진입을 감지합니다.",
    configLabel: "차단 심리 상태",
  },
  liq_distance: {
    label: "청산가 거리 경고",
    description: "청산가와 진입가 사이 거리가 설정값 미만이면 감지합니다.",
    configLabel: "최소 거리 (%)",
  },
  loss_streak: {
    label: "연속 손실 휴식",
    description: "N연속 손실 후 휴식 없이 재진입하면 감지합니다.",
    configLabel: "연속 손실 횟수",
  },
};

// ── config 유효성 검증 ────────────────────────────────────────────────────────

/**
 * 룰 config 유효성 검증
 * @returns 오류 메시지 (null이면 유효)
 */
export function validateRuleConfig(type: RuleType, config: unknown): string | null {
  if (typeof config !== "object" || !config) return "config는 객체여야 합니다";
  const c = config as Record<string, unknown>;

  switch (type) {
    case "time_block": {
      if (!Array.isArray(c.hours) || c.hours.length === 0)
        return "hours는 비어있지 않은 배열이어야 합니다";
      if (c.hours.some((h: unknown) => typeof h !== "number" || h < 0 || h > 23))
        return "hours의 각 값은 0~23 사이 정수여야 합니다";
      break;
    }
    case "cooldown": {
      if (typeof c.minutes !== "number" || c.minutes <= 0)
        return "minutes는 양수여야 합니다";
      if (c.after !== "loss" && c.after !== "any")
        return "after는 'loss' 또는 'any'여야 합니다";
      break;
    }
    case "daily_limit": {
      if (typeof c.lossPercent !== "number" || c.lossPercent <= 0 || c.lossPercent > 100)
        return "lossPercent는 0 초과 100 이하여야 합니다";
      break;
    }
    case "psych_block": {
      if (!Array.isArray(c.blockedStates) || c.blockedStates.length === 0)
        return "blockedStates는 비어있지 않은 배열이어야 합니다";
      if (!c.blockedStates.every((s: unknown) => typeof s === "string"))
        return "blockedStates의 각 항목은 문자열이어야 합니다";
      break;
    }
    case "liq_distance": {
      if (typeof c.minPercent !== "number" || c.minPercent <= 0)
        return "minPercent는 양수여야 합니다";
      break;
    }
    case "loss_streak": {
      if (typeof c.count !== "number" || c.count < 2)
        return "count는 2 이상이어야 합니다";
      if (typeof c.restMinutes !== "number" || c.restMinutes <= 0)
        return "restMinutes는 양수여야 합니다";
      break;
    }
    default:
      return "지원하지 않는 룰 타입입니다";
  }
  return null;
}
