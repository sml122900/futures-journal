// 플랜별 기능 권한 정의

export type Plan = "free" | "pro" | "premium" | "team";

export type Feature =
  | "stats_90d"        // 90일 이상 통계
  | "rules_unlimited"  // 무제한 룰 (무료는 1개)
  | "csv_export"       // CSV 내보내기
  | "excel_export"     // Excel 내보내기
  | "ai_reports"       // AI 주간/월간 리포트
  | "ai_coach"         // AI 코치 채팅
  | "milestones"       // 마일스톤 시스템
  | "telegram"         // 텔레그램 알림
  | "team_features";   // 팀 기능

const PLAN_FEATURES: Record<Plan, Feature[]> = {
  free: ["milestones"],
  pro: [
    "stats_90d", "rules_unlimited", "csv_export", "excel_export",
    "milestones",
  ],
  premium: [
    "stats_90d", "rules_unlimited", "csv_export", "excel_export",
    "ai_reports", "ai_coach", "milestones", "telegram",
  ],
  team: [
    "stats_90d", "rules_unlimited", "csv_export", "excel_export",
    "ai_reports", "ai_coach", "milestones", "telegram", "team_features",
  ],
};

export function canUseFeature(plan: Plan, feature: Feature): boolean {
  return PLAN_FEATURES[plan]?.includes(feature) ?? false;
}

export interface PlanInfo {
  label: string;
  priceKrw: number;
  description: string;
  features: string[];
  highlight?: boolean;
}

export const PLAN_INFO: Record<Plan, PlanInfo> = {
  free: {
    label: "무료",
    priceKrw: 0,
    description: "시작하기 좋은 무료 플랜",
    features: ["7일 통계", "룰 1개", "음성 메모 (크레딧)", "마일스톤"],
  },
  pro: {
    label: "Pro",
    priceKrw: 9900,
    description: "진지한 트레이더를 위한 플랜",
    features: ["90일 통계", "무제한 룰", "CSV/Excel 내보내기", "마일스톤"],
    highlight: true,
  },
  premium: {
    label: "Premium",
    priceKrw: 19900,
    description: "AI 코칭이 필요한 트레이더",
    features: ["Pro 모든 기능", "AI 주간/월간 리포트", "AI 코치 채팅", "텔레그램 알림"],
  },
  team: {
    label: "Team",
    priceKrw: 49900,
    description: "팀/멘토용 플랜",
    features: ["Premium 모든 기능", "팀원 5명", "멘토 기능", "전담 지원"],
  },
};
