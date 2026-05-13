// 알림 발송 라이브러리 — 타입별 알림 함수
import prisma from "./prisma";
import { sendTelegramMessage } from "./telegram";
import {
  ruleViolationTemplate,
  largeLossTemplate,
  liquidationRiskTemplate,
  memoReminderTemplate,
  weeklyReportTemplate,
  milestoneTemplate,
} from "./notification-templates";
import type { TradingRule } from "@prisma/client";

const ONE_HOUR = 60 * 60 * 1000;

async function getNotifSetting(userId: string) {
  return prisma.notificationSetting.findUnique({ where: { userId } });
}

export async function notifyRuleViolation(
  userId: string,
  rule: TradingRule,
  position: { symbol: string; side: string }
): Promise<void> {
  try {
    const ns = await getNotifSetting(userId);
    if (!ns?.telegramLinked || !ns.telegramChatId || !ns.ruleViolation) return;
    const msg = ruleViolationTemplate(rule, position);
    await sendTelegramMessage(ns.telegramChatId, msg.text, {
      parseMode: "MarkdownV2",
      inlineKeyboard: msg.buttons,
    });
  } catch (err) {
    console.error("[notify] ruleViolation", err);
  }
}

export async function notifyLargeLoss(
  userId: string,
  position: { symbol: string; pnl: number; pnlPercent: number }
): Promise<void> {
  try {
    const ns = await getNotifSetting(userId);
    if (!ns?.telegramLinked || !ns.telegramChatId || !ns.largeLoss) return;
    if (ns.largeLossLastSentAt && Date.now() - ns.largeLossLastSentAt.getTime() < ONE_HOUR) return;
    const msg = largeLossTemplate(position);
    const sent = await sendTelegramMessage(ns.telegramChatId, msg.text, {
      parseMode: "MarkdownV2",
      inlineKeyboard: msg.buttons,
    });
    if (sent) {
      await prisma.notificationSetting.update({
        where: { userId },
        data: { largeLossLastSentAt: new Date() },
      });
    }
  } catch (err) {
    console.error("[notify] largeLoss", err);
  }
}

export async function notifyLiquidationRisk(
  userId: string,
  position: { symbol: string; mmr: number; liqPrice: number; currentPrice: number }
): Promise<void> {
  try {
    const ns = await getNotifSetting(userId);
    if (!ns?.telegramLinked || !ns.telegramChatId || !ns.liquidationRisk) return;
    if (ns.liquidationLastSentAt && Date.now() - ns.liquidationLastSentAt.getTime() < ONE_HOUR) return;
    const msg = liquidationRiskTemplate(position);
    const sent = await sendTelegramMessage(ns.telegramChatId, msg.text, {
      parseMode: "MarkdownV2",
      inlineKeyboard: msg.buttons,
    });
    if (sent) {
      await prisma.notificationSetting.update({
        where: { userId },
        data: { liquidationLastSentAt: new Date() },
      });
    }
  } catch (err) {
    console.error("[notify] liquidationRisk", err);
  }
}

export async function notifyMemoReminder(
  userId: string,
  position: { symbol: string; closedAt: Date }
): Promise<void> {
  try {
    const ns = await getNotifSetting(userId);
    if (!ns?.telegramLinked || !ns.telegramChatId || !ns.memoReminder) return;
    const msg = memoReminderTemplate(position);
    await sendTelegramMessage(ns.telegramChatId, msg.text, {
      parseMode: "MarkdownV2",
      inlineKeyboard: msg.buttons,
    });
  } catch (err) {
    console.error("[notify] memoReminder", err);
  }
}

export async function notifyWeeklyReport(
  userId: string,
  reportId: string,
  summary: { totalPnl: number; winRate: number; trades: number; pnlPercent?: number }
): Promise<void> {
  try {
    const ns = await getNotifSetting(userId);
    if (!ns?.telegramLinked || !ns.telegramChatId || !ns.weeklyReport) return;
    const msg = weeklyReportTemplate(reportId, summary);
    await sendTelegramMessage(ns.telegramChatId, msg.text, {
      parseMode: "MarkdownV2",
      inlineKeyboard: msg.buttons,
    });
  } catch (err) {
    console.error("[notify] weeklyReport", err);
  }
}

export async function notifyMilestone(
  userId: string,
  milestone: { type: string; label: string; icon?: string }
): Promise<void> {
  try {
    const ns = await getNotifSetting(userId);
    if (!ns?.telegramLinked || !ns.telegramChatId || !ns.milestoneAlert) return;
    const msg = milestoneTemplate(milestone);
    await sendTelegramMessage(ns.telegramChatId, msg.text, {
      parseMode: "MarkdownV2",
      inlineKeyboard: msg.buttons,
    });
  } catch (err) {
    console.error("[notify] milestone", err);
  }
}
