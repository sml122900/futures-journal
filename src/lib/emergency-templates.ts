// Emergency Brake 텔레그램 알림 시퀀스 템플릿 (MarkdownV2)
import type { InlineButton } from "@/lib/telegram";

// MarkdownV2 이스케이프
function esc(v: string | number): string {
  return String(v).replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

export interface EmergencyContext {
  symbol:    string;
  side:      "long" | "short";
  size:      number;
  sessionId: string;
  // 하위 호환 (scheduler에서 사용)
  triggers?: { type: string; message: string }[];
  forceSentence?: string;
  // legacy — 사용되지 않지만 템플릿 일부가 참조
  avgSize?: number;
  sizeMultiplier?: number;
  consecutiveProfitDays?: number;
  pastSimilarCount?: number;
}

export interface TelegramMessage {
  text: string;
  parseMode: "MarkdownV2";
  inlineKeyboard?: InlineButton[][];
}

const APP_URL = process.env.NEXTAUTH_URL ?? "https://futures-journal.vercel.app";

export function buildStep1Alert(ctx: EmergencyContext): TelegramMessage {
  const side = ctx.side === "long" ? "Long" : "Short";
  const chartUrl = `https://www.bitget.com/futures/usdt/${ctx.symbol}`;
  const triggerLines = (ctx.triggers ?? [])
    .map((t, i) => `${i + 1}\\. ${esc(t.message)}`)
    .join("\n");
  return {
    text:
      `🚨🚨🚨 *Emergency Brake 발동*\n\n` +
      `${esc(ctx.symbol)} ${esc(side)} *${esc(ctx.size.toFixed(0))} USDT*\n\n` +
      `*위반 룰:*\n${triggerLines || "규칙 위반 감지"}\n\n` +
      `잠깐\\, 정말 진행하시겠습니까?`,
    parseMode: "MarkdownV2",
    inlineKeyboard: [
      [
        { text: "🛑 청산하기", callback_data: `emergency_close_${ctx.sessionId}` },
        { text: "📊 차트 보기", url: chartUrl },
      ],
    ],
  };
}

export function buildStep2Alert(ctx: EmergencyContext): TelegramMessage {
  void ctx;
  return {
    text:
      `🛑 *지금 청산하면 손실 최소*\n\n` +
      `슬리피지가 작은 지금이 청산 골든타임입니다\\.\n\n` +
      `진입 후 30초가 지나면 시장이 움직여\n` +
      `돌이키기 어려워질 수 있습니다\\.`,
    parseMode: "MarkdownV2",
    inlineKeyboard: [
      [{ text: "🛑 지금 청산", callback_data: `emergency_close_${ctx.sessionId}` }],
    ],
  };
}

export function buildStep3Alert(ctx: EmergencyContext): TelegramMessage {
  void ctx;
  return {
    text:
      `📊 *규칙은 지킬 때 의미가 있습니다*\n\n` +
      `스스로 정한 규칙을 어기면\n` +
      `다음에도 어기게 됩니다\\.\n\n` +
      `지금 멈추면 오늘의 규율이 됩니다\\.`,
    parseMode: "MarkdownV2",
  };
}

export function buildStep4Alert(ctx: EmergencyContext): TelegramMessage {
  const count = ctx.pastSimilarCount;
  if (!count || count === 0) {
    return {
      text:
        `⚠️ *자기 자신에게 묻는 시간*\n\n` +
        `이 매매\\, 계획에 있었나요?\n\n` +
        `계획 없는 매매는 도박입니다\\.\n` +
        `지금 차트를 다시 냉정하게 보세요\\.`,
      parseMode: "MarkdownV2",
    };
  }
  return {
    text:
      `⚠️ *과거 데이터 경고*\n\n` +
      `규칙 위반 후 매매에서\n` +
      `최근 90일간 ${esc(count)}회 손실이 발생했습니다\\.\n\n` +
      `같은 패턴 ${esc(count + 1)}번째 시도일 수 있습니다\\.`,
    parseMode: "MarkdownV2",
  };
}

export function buildStep5Alert(ctx: EmergencyContext): TelegramMessage {
  void ctx;
  return {
    text:
      `📖 *코치의 말*\n\n` +
      `잠깐 차트에서 눈을 떼세요\\.\n\n` +
      `화장실 다녀오시거나 물 한 잔 마시세요\\.\n` +
      `1분 후 다시 결정하셔도 늦지 않습니다\\.\n\n` +
      `좋은 매매는 절대 "지금 당장"이 아닙니다\\.\n` +
      `좋은 매매는 "준비된 순간"입니다\\.\n\n` +
      `오늘 이 매매\\, 정말 준비됐나요?`,
    parseMode: "MarkdownV2",
  };
}

export function buildStep6Alert(ctx: EmergencyContext): TelegramMessage {
  return {
    text:
      `⏰ *마지막 확인*\n\n` +
      `1분이 지났습니다\\. 지금 결정하세요:\n\n` +
      `어떤 선택이든 데이터로 기록됩니다\\.\n` +
      `자기 자신을 정직하게 마주하세요\\.`,
    parseMode: "MarkdownV2",
    inlineKeyboard: [
      [{ text: "🛑 청산하기", callback_data: `emergency_close_${ctx.sessionId}` }],
      [{ text: "😤 그래도 진행", callback_data: `emergency_keep_${ctx.sessionId}` }],
    ],
  };
}

export function buildStep7FollowUp(
  ctx: EmergencyContext,
  status: { stillOpen: boolean; pnl?: number; pnlPercent?: number }
): TelegramMessage {
  if (!status.stillOpen) {
    return {
      text:
        `✅ *5분 경과 — 잘 결정하셨습니다*\n\n` +
        `충동을 이긴 자기 자신을 칭찬하세요\\.\n\n` +
        `오늘의 결정이 한 달 후 큰 수익을 지키는 행동이 될 것입니다\\.`,
      parseMode: "MarkdownV2",
    };
  }
  const pnlStr = status.pnl !== undefined ? esc(status.pnl.toFixed(2)) : "\\-\\-";
  const pctStr = status.pnlPercent !== undefined ? esc(status.pnlPercent.toFixed(1)) : "\\-\\-";
  return {
    text:
      `💬 *5분 경과 — 상황 점검*\n\n` +
      `현재 상태:\n` +
      `• 포지션: ${esc(ctx.symbol)} ${esc(ctx.side === "long" ? "Long" : "Short")} ${esc(ctx.size.toFixed(0))} USDT \\(유지 중\\)\n` +
      `• 현재 PnL: ${pnlStr} USDT \\(${pctStr}\\%\\)\n\n` +
      `SL 설정은 했나요\\?\n` +
      `없으면 지금이라도 설정하세요\\.`,
    parseMode: "MarkdownV2",
    inlineKeyboard: [
      [{ text: "📝 일지 기록", url: `${APP_URL}/dashboard` }],
    ],
  };
}

export interface AlertSequenceStep {
  step: number;
  delayMs: number;
  builder: (ctx: EmergencyContext) => TelegramMessage;
}

export function getSequenceForLevel(level: 1 | 2 | 3): AlertSequenceStep[] {
  const all: AlertSequenceStep[] = [
    { step: 1, delayMs: 1_000,       builder: buildStep1Alert },
    { step: 2, delayMs: 4_000,       builder: buildStep2Alert },
    { step: 3, delayMs: 10_000,      builder: buildStep3Alert },
    { step: 4, delayMs: 20_000,      builder: buildStep4Alert },
    { step: 5, delayMs: 35_000,      builder: buildStep5Alert },
    { step: 6, delayMs: 60_000,      builder: buildStep6Alert },
    { step: 7, delayMs: 5 * 60_000,  builder: (ctx) => buildStep7FollowUp(ctx, { stillOpen: true }) },
  ];
  if (level === 1) return [all[0]];
  if (level === 2) return all.slice(0, 3);
  return all; // level 3: 전체
}
