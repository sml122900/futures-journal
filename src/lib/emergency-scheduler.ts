// Emergency 알림 시퀀스 시작 + DB 예약 저장
import prisma from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";
import { getSequenceForLevel } from "@/lib/emergency-templates";
import { sendEmergencyPush } from "@/lib/fcm-sender";
import type { TriggerDecision } from "@/lib/trigger-checker";
import type { EmergencyContext } from "@/lib/emergency-templates";

interface PositionInfo {
  positionId: string;
  exchange: string;
  symbol: string;
  side: "long" | "short";
  size: number;
}

export async function startEmergencySequence(
  userId: string,
  position: PositionInfo,
  decision: TriggerDecision
): Promise<void> {
  if (decision.level === 0) return;

  const setting = await prisma.notificationSetting.findUnique({ where: { userId } });
  if (!setting?.telegramLinked || !setting.telegramChatId) return;

  const triggersJson = decision.triggers as unknown as import("@prisma/client").Prisma.InputJsonValue;
  const contextJson  = { triggers: decision.triggers } as unknown as import("@prisma/client").Prisma.InputJsonValue;

  const session = await prisma.emergencyAlertSession.create({
    data: {
      userId,
      positionId:     position.positionId,
      exchange:       position.exchange,
      symbol:         position.symbol,
      side:           position.side,
      size:           position.size,
      sizeMultiplier: 0, // 새 시스템에서는 미사용
      level:          decision.level,
      triggers:       triggersJson,
      context:        contextJson,
      forceSentence:  decision.forceSentence,
    },
  });

  const sequence = getSequenceForLevel(decision.level as 1 | 2 | 3);
  const now = Date.now();

  const ctx: EmergencyContext = {
    symbol:       position.symbol,
    side:         position.side,
    size:         position.size,
    sessionId:    session.id,
    triggers:     decision.triggers,
    forceSentence: decision.forceSentence,
  };

  // step 1 즉시 발송
  const firstMsg = sequence[0].builder(ctx);
  try {
    await sendTelegramMessage(setting.telegramChatId, firstMsg.text, {
      parseMode:      firstMsg.parseMode,
      inlineKeyboard: firstMsg.inlineKeyboard,
    });
    await prisma.emergencyAlertSession.update({
      where: { id: session.id },
      data:  { alertsSent: 1 },
    });
  } catch { /* 발송 실패 시 세션 유지 */ }

  // FCM 푸시 (안드로이드 앱) — level 2 이상
  if (decision.level >= 2) {
    sendEmergencyPush(userId, {
      sessionId:      session.id,
      level:          decision.level,
      symbol:         position.symbol,
      side:           position.side,
      size:           position.size,
      sizeMultiplier: 0,
      triggers:       decision.triggers.map(t => t.type),
      forceSentence:  decision.forceSentence,
      countdown:      60,
    }).catch((e) => console.error("[FCM] sendEmergencyPush error", e));
  }

  // 나머지 step DB 예약
  for (const step of sequence.slice(1)) {
    await prisma.emergencyScheduledAlert.create({
      data: {
        sessionId:   session.id,
        step:        step.step,
        scheduledAt: new Date(now + step.delayMs),
        status:      "pending",
      },
    });
  }
}
