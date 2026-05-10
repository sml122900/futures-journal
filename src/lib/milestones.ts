// 마일스톤 정의 및 메타데이터

export type MilestoneType =
  | "first_trade"
  | "trades_10"
  | "trades_100"
  | "win_streak_5"
  | "win_streak_10"
  | "profitable_week"
  | "profitable_month"
  | "monthly_10_percent"
  | "rule_compliance_week"
  | "fomo_zero_week"
  | "memo_streak_7"
  | "7day_profit_streak"
  | "14day_profit_streak";

export interface MilestoneMeta {
  label: string;
  description: string;
  icon: string;
  rarity: "bronze" | "silver" | "gold" | "diamond";
}

export const MILESTONE_META: Record<MilestoneType, MilestoneMeta> = {
  first_trade:        { label: "첫 거래",          description: "첫 번째 포지션을 종료했습니다.",               icon: "🚀", rarity: "bronze"  },
  trades_10:          { label: "10거래 달성",       description: "누적 10회 포지션을 완료했습니다.",             icon: "📈", rarity: "bronze"  },
  trades_100:         { label: "100거래 달성",      description: "누적 100회 포지션을 완료했습니다.",            icon: "💯", rarity: "silver"  },
  win_streak_5:       { label: "5연승",            description: "5개 포지션 연속 수익을 달성했습니다.",          icon: "🔥", rarity: "bronze"  },
  win_streak_10:      { label: "10연승",           description: "10개 포지션 연속 수익을 달성했습니다.",         icon: "⚡", rarity: "gold"    },
  profitable_week:    { label: "주간 흑자",         description: "한 주 누적 손익이 플러스입니다.",              icon: "📅", rarity: "bronze"  },
  profitable_month:   { label: "월간 흑자",         description: "한 달 누적 손익이 플러스입니다.",              icon: "📆", rarity: "silver"  },
  monthly_10_percent: { label: "월 +10%",          description: "월 수익률 10% 이상을 달성했습니다.",          icon: "🏆", rarity: "gold"    },
  rule_compliance_week:{ label: "룰 완전 준수 주",  description: "한 주 동안 룰 위반이 0건입니다.",              icon: "🛡️", rarity: "silver"  },
  fomo_zero_week:     { label: "FOMO 제로 주",      description: "한 주 동안 FOMO 심리 위반이 없습니다.",        icon: "🧘", rarity: "gold"    },
  memo_streak_7:      { label: "메모 7일 연속",      description: "7일 연속으로 매매 후 메모를 작성했습니다.",     icon: "📝", rarity: "silver"  },
  "7day_profit_streak":  { label: "7일 연속 흑자",  description: "7일 연속으로 일일 손익이 플러스입니다.",       icon: "🌟", rarity: "gold"    },
  "14day_profit_streak": { label: "14일 연속 흑자", description: "14일 연속으로 일일 손익이 플러스입니다.",      icon: "💎", rarity: "diamond" },
};

export const RARITY_COLORS: Record<MilestoneMeta["rarity"], string> = {
  bronze:  "text-amber-600  bg-amber-600/10  border-amber-600/30",
  silver:  "text-slate-400  bg-slate-400/10  border-slate-400/30",
  gold:    "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  diamond: "text-cyan-400   bg-cyan-400/10   border-cyan-400/30",
};
