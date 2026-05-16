// Emergency 알림 시퀀스 시작 + DB 예약 저장
import prisma from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";
import { getSequenceForLevel } from "@/lib/emergency-templates";
import type { EmergencyDecision } from "@/lib/emergency-detector";
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
  decision: EmergencyDecision
): Promise<void> {
  if (decision.level === 0) return;

  const setting = await prisma.notificationSetting.findUnique({ where: { userId } });
  if (!setting?.telegramLinked || !setting.telegramChatId) return;

  const session = await prisma.emergencyAlertSession.create({
    data: {
      userId,
      positionId: position.positionId,
      exchange:   position.exchange,
      symbol:     position.symbol,
      side:       position.side,
      size:       position.size,
      sizeMultiplier: decision.context.sizeMultiplier,
      level:    decision.level,
      triggers: decision.triggers as unknown as import("@prisma/client").Prisma.InputJsonValue,
      context:  decision.context  as unknown as import("@prisma/client").Prisma.InputJsonValue,
    },
  });

  const sequence = getSequenceForLevel(decision.level as 1 | 2 | 3);
  const now = Date.now();

  const ctx: EmergencyContext = {
    symbol:   position.symbol,
    side:     position.side,
    size:     position.size,
    sessionId: session.id,
    ...decision.context,
  };

  // step 1 즉시 발송
  const firstMsg = sequence[0].builder(ctx);
  try {
    await sendTelegramMessage(setting.telegramChatId, firstMsg.text, {
      parseMode:     firstMsg.parseMode,
      inlineKeyboard: firstMsg.inlineKeyboard,
    });
    await prisma.emergencyAlertSession.update({
      where: { id: session.id },
      data:  { alertsSent: 1 },
    });
  } catch { /* 발송 실패 시 세션은 유지, 이후 cron이 재시도 가능 */ }

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
