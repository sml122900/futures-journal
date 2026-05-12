// AI 프롬프트 템플릿 모음

export const WEEKLY_REPORT_SYSTEM = `당신은 선물 거래 트레이더의 전담 매매 코치입니다.
사용자의 이번 주 거래 데이터를 분석해 JSON 형식의 주간 리포트를 생성하세요.

규칙:
- 구체적인 수치를 반드시 포함하세요.
- 칭찬은 데이터 근거가 있을 때만 하세요.
- 개선점은 명확하고 실행 가능한 형태로 제시하세요.
- 다음 주 목표는 달성 가능한 수준으로 설정하세요.
- 반드시 JSON만 반환하세요. 마크다운 코드블록 포함 금지.

JSON 구조:
{
  "summary": {
    "trades": number,
    "winRate": number,
    "winRateChange": number | null,
    "totalPnl": number,
    "totalPnlPercent": number | null
  },
  "highlights": string[],
  "improvements": [
    { "issue": string, "suggestion": string }
  ],
  "nextWeekGoals": string[],
  "coachComment": string
}`;

/**
 * 주간 리포트용 사용자 프롬프트 생성
 */
export function buildWeeklyReportPrompt(data: {
  period: { start: string; end: string };
  summary: { totalTrades: number; winRate: number; totalPnl: number };
  patternMatrix: Array<{ reason: string; psych: string; count: number; winRate: number; totalPnl: number }>;
  timeHeatmap: Array<{ dayOfWeek: number; hour: number; count: number; winRate: number; totalPnl: number }>;
  symbolStats: Array<{ symbol: string; trades: number; winRate: number; avgRoi: number; totalPnl: number }>;
  violations: Array<{ ruleType: string; count: number }>;
  memoSamples: Array<{ reason: string; psych: string; exitReason: string }>;
  diaries?: Array<{ createdAt: string; mood: string | null; content: string; tags: string[] }>;
}): string {
  const DAY = ["일", "월", "화", "수", "목", "금", "토"];

  const patternLines = data.patternMatrix.slice(0, 6)
    .map((p) => `  - ${p.reason} + ${p.psych}: ${p.count}회, 승률 ${p.winRate}%, 손익 ${p.totalPnl.toFixed(1)} U`)
    .join("\n");

  const heatmapTopLines = data.timeHeatmap
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((h) => `  - ${DAY[h.dayOfWeek]}요일 ${h.hour}시: ${h.count}회, 승률 ${h.winRate}%, 손익 ${h.totalPnl.toFixed(1)} U`)
    .join("\n");

  const symbolLines = data.symbolStats.slice(0, 5)
    .map((s) => `  - ${s.symbol}: ${s.trades}회, 승률 ${s.winRate}%, avgROI ${s.avgRoi}%, 손익 ${s.totalPnl.toFixed(1)} U`)
    .join("\n");

  const violationLines = data.violations.length
    ? data.violations.map((v) => `  - ${v.ruleType}: ${v.count}회`).join("\n")
    : "  없음";

  const memoLines = data.memoSamples.slice(0, 5)
    .map((m) => `  - 진입: ${m.reason || "없음"} / 심리: ${m.psych || "없음"} / 청산: ${m.exitReason || "없음"}`)
    .join("\n");

  const diaryLines = (data.diaries ?? []).slice(0, 7)
    .map((d) => {
      const mood = d.mood ? `[${d.mood}] ` : "";
      const content = d.content.length > 100 ? d.content.slice(0, 100) + "…" : d.content;
      return `  - ${d.createdAt.slice(0, 10)} ${mood}${content}`;
    })
    .join("\n");

  return `분석 기간: ${data.period.start} ~ ${data.period.end}

== 기본 통계 ==
- 총 거래: ${data.summary.totalTrades}회
- 승률: ${data.summary.winRate}%
- 순손익: ${data.summary.totalPnl.toFixed(2)} USDT

== 진입이유 × 심리 패턴 ==
${patternLines || "  (메모 없음)"}

== 활발한 시간대 TOP 5 ==
${heatmapTopLines || "  (데이터 없음)"}

== 심볼별 성과 ==
${symbolLines || "  (데이터 없음)"}

== 룰 위반 ==
${violationLines}

== 메모 샘플 ==
${memoLines || "  (메모 없음)"}

== 매매 심리 일기 ==
${diaryLines || "  (일기 없음)"}
${diaryLines ? "\n위 일기를 참고해 특정 mood가 매매 성과에 어떤 영향을 미쳤는지 분석하고, 심리 개선 조언을 포함하세요." : ""}

위 데이터를 바탕으로 주간 리포트 JSON을 생성하세요.`;
}

export const MONTHLY_REPORT_SYSTEM = WEEKLY_REPORT_SYSTEM.replace("이번 주", "이번 달").replace("다음 주", "다음 달");
