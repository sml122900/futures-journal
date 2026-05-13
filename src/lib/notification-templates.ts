// 텔레그램 알림 메시지 템플릿 (한국어 코치 톤, MarkdownV2)
import type { TradingRule } from "@prisma/client";

const APP_URL = process.env.NEXTAUTH_URL ?? "https://futures-journal.vercel.app";

type TgMessage = {
  text: string;
  buttons?: Array<Array<{ text: string; url: string }>>;
};

/** MarkdownV2 특수문자 이스케이프 — 동적 값(심볼, 숫자 등)에 적용 */
export function esc(v: string | number): string {
  return String(v).replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

function ruleTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    time_block:   "시간대 제한",
    cooldown:     "쿨다운 미준수",
    daily_limit:  "일일 손실 한도 초과",
    psych_block:  "심리 상태 차단",
    liq_distance: "청산가 근접 진입",
    loss_streak:  "연속 손실 제한",
  };
  return labels[type] ?? type;
}

export function ruleViolationTemplate(
  rule: TradingRule,
  position: { symbol: string; side: string }
): TgMessage {
  const sideKr = position.side === "long" ? "Long" : position.side === "short" ? "Short" : position.side;
  const label = ruleTypeLabel(rule.type);
  return {
    text: `⚠️ *룰 위반 감지*\n\n방금 ${esc(position.symbol)} ${esc(sideKr)} 포지션을 진입하셨는데, 등록하신 룰을 위반했습니다\\.\n\n위반 룰: *${esc(label)}*\n\n진입을 다시 한번 점검해보세요\\.`,
    buttons: [[{ text: "📊 대시보드 보기", url: `${APP_URL}/dashboard` }]],
  };
}

export function largeLossTemplate(position: {
  symbol: string;
  pnl: number;
  pnlPercent: number;
}): TgMessage {
  const pnlStr = esc(position.pnl.toFixed(2));
  const pctStr = esc(Math.abs(position.pnlPercent).toFixed(1));
  return {
    text: `💔 *큰 손실 거래 종료*\n\n${esc(position.symbol)} 포지션이 *\\-${pctStr}%* 손실로 종료됐습니다\\.\n손실액: *${pnlStr} USDT*\n\n지금이 회고를 작성하기 가장 좋은 시점입니다\\.\n30분 쿨다운 권장\\.`,
    buttons: [[{ text: "📝 회고 메모 작성하기", url: `${APP_URL}/dashboard` }]],
  };
}

export function liquidationRiskTemplate(pos: {
  symbol: string;
  mmr: number;
  liqPrice: number;
  currentPrice: number;
}): TgMessage {
  const mmrPct = esc((pos.mmr * 100).toFixed(0));
  const extraLines: string[] = [];
  if (pos.liqPrice > 0 && pos.currentPrice > 0) {
    const marginPct = esc(
      Math.abs((pos.currentPrice - pos.liqPrice) / pos.currentPrice * 100).toFixed(1)
    );
    extraLines.push(`청산가: ${esc(pos.liqPrice.toFixed(2))}`);
    extraLines.push(`현재가: ${esc(pos.currentPrice.toFixed(2))} \\(\\-${marginPct}% 여유\\)`);
  }
  const details = extraLines.length ? "\n" + extraLines.join("\n") : "";
  return {
    text: `🚨 *청산 위험 경고*\n\n${esc(pos.symbol)} 포지션의 청산가가 매우 가깝습니다\\.\n\n현재 MMR: *${mmrPct}%*${details}\n\n증거금 추가 또는 부분 청산을 고려하세요\\.`,
    buttons: [[{ text: "📊 대시보드 보기", url: `${APP_URL}/dashboard` }]],
  };
}

export function memoReminderTemplate(pos: {
  symbol: string;
  closedAt: Date;
}): TgMessage {
  const timeStr = pos.closedAt.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  return {
    text: `📝 *메모 리마인더*\n\n${esc(pos.symbol)} 포지션 \\(${esc(timeStr)} 종료\\)에 아직 회고 메모를 작성하지 않으셨어요\\.\n\n기억이 생생할 때 작성하시면 실력 향상에 도움이 됩니다\\!`,
    buttons: [[{ text: "✏️ 메모 작성하기", url: `${APP_URL}/dashboard` }]],
  };
}

export function weeklyReportTemplate(
  reportId: string,
  summary: { totalPnl: number; winRate: number; trades: number; pnlPercent?: number }
): TgMessage {
  const pnlSign = summary.totalPnl >= 0 ? "\\+" : "\\-";
  const pnlStr = `${pnlSign}${esc(Math.abs(summary.totalPnl).toFixed(2))}`;
  let pctStr = "";
  if (summary.pnlPercent !== undefined) {
    const pctSign = summary.pnlPercent >= 0 ? "\\+" : "\\-";
    pctStr = ` \\(${pctSign}${esc(Math.abs(summary.pnlPercent).toFixed(1))}%\\)`;
  }
  void reportId;
  return {
    text: `📊 *이번 주 리포트 도착*\n\n거래 ${esc(summary.trades)}회 \\| 승률 ${esc(summary.winRate.toFixed(0))}% \\| *${pnlStr} USDT*${pctStr}`,
    buttons: [[{ text: "📖 리포트 전체 보기", url: `${APP_URL}/stats` }]],
  };
}

export function milestoneTemplate(milestone: {
  type: string;
  label: string;
  icon?: string;
}): TgMessage {
  const icon = milestone.icon ?? "🎉";
  return {
    text: `${icon} *마일스톤 달성\\!*\n\n*"${esc(milestone.label)}"* 달성하셨습니다\\!\n\n계속 이 페이스로 꾸준히 성장하세요\\! 💪`,
    buttons: [[{ text: "🏆 마일스톤 갤러리", url: `${APP_URL}/milestones` }]],
  };
}
