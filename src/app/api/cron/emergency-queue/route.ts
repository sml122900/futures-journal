// Emergency 알림 큐 처리 Cron (매분 실행)
// vercel.json: "* * * * *"
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";
import { getSequenceForLevel, buildStep7FollowUp } from "@/lib/emergency-templates";
import type { EmergencyContext } from "@/lib/emergency-templates";
import { createExchangeForUser } from "@/lib/exchanges";
import type { ExchangeId } from "@/lib/exchanges";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? new URL(req.url).searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const dueAlerts = await prisma.emergencyScheduledAlert.findMany({
    where: { status: "pending", scheduledAt: { lte: new Date() } },
    include: {
      session: {
        include: { user: { select: { id: true } } },
      },
    },
    take: 50,
    orderBy: { scheduledAt: "asc" },
  });

  let processed = 0;

  for (const alert of dueAlerts) {
    try {
      const sess = alert.session;

      // 세션 취소됐으면 스킵
      if (sess.cancelledAt) {
        await prisma.emergencyScheduledAlert.update({
          where: { id: alert.id },
          data:  { status: "cancelled" },
        });
        continue;
      }

      // step 7 이전이면 포지션 상태 확인 (오픈 여부)
      let stillOpen = true;
      if (alert.step < 7) {
        try {
          const inst = await createExchangeForUser(sess.userId, sess.exchange as ExchangeId);
          if (inst) {
            const openPositions = await inst.getPositions();
            stillOpen = openPositions.some(
              (p) =>
                String(p.positionId ?? p.marginCoin ?? "") === sess.positionId ||
                String(p.symbol ?? "") === sess.symbol
            );
          }
        } catch { /* 조회 실패 → 포지션 유지로 간주 */ }

        if (!stillOpen) {
          // 사용자가 청산함 → 전체 시퀀스 취소 + 칭찬 메시지
          await prisma.emergencyAlertSession.update({
            where: { id: sess.id },
            data:  { userAction: "closed", cancelledAt: new Date() },
          });
          await prisma.emergencyScheduledAlert.updateMany({
            where: { sessionId: sess.id, status: "pending" },
            data:  { status: "cancelled" },
          });
          const setting = await prisma.notificationSetting.findUnique({ where: { userId: sess.userId } });
          if (setting?.telegramChatId) {
            await sendTelegramMessage(
              setting.telegramChatId,
              `✅ *잘 결정하셨습니다\\!*\n\n충동을 이긴 자기 자신을 칭찬하세요\\.`,
              { parseMode: "MarkdownV2" }
            );
          }
          continue;
        }
      }

      // 발송할 step 찾기
      const sequence = getSequenceForLevel(sess.level as 1 | 2 | 3);
      const stepDef = sequence.find((s) => s.step === alert.step);
      if (!stepDef) {
        await prisma.emergencyScheduledAlert.update({ where: { id: alert.id }, data: { status: "cancelled" } });
        continue;
      }

      const setting = await prisma.notificationSetting.findUnique({ where: { userId: sess.userId } });
      if (!setting?.telegramChatId) continue;

      const storedCtx = sess.context as unknown as Omit<EmergencyContext, "symbol" | "side" | "size" | "sessionId">;
      const ctx: EmergencyContext = {
        symbol:    sess.symbol,
        side:      sess.side as "long" | "short",
        size:      sess.size,
        sessionId: sess.id,
        ...storedCtx,
      };

      let msg;
      if (alert.step === 7) {
        // step 7: 현재 PnL 조회 시도
        let pnl: number | undefined;
        let pnlPercent: number | undefined;
        try {
          const inst = await createExchangeForUser(sess.userId, sess.exchange as ExchangeId);
          if (inst) {
            const openPositions = await inst.getPositions();
            const pos = openPositions.find((p) => String(p.symbol ?? "") === sess.symbol);
            if (pos) {
              pnl = parseFloat(String(pos.unrealizedPL ?? pos.achievedProfits ?? 0));
              const margin = parseFloat(String(pos.marginSize ?? 1));
              pnlPercent = margin > 0 ? (pnl / margin) * 100 : 0;
              stillOpen = true;
            } else {
              stillOpen = false;
            }
          }
        } catch { /* 조회 실패 시 stillOpen=true로 일반 메시지 */ }
        msg = buildStep7FollowUp(ctx, { stillOpen, pnl, pnlPercent });
      } else {
        msg = stepDef.builder(ctx);
      }

      await sendTelegramMessage(setting.telegramChatId, msg.text, {
        parseMode:     msg.parseMode,
        inlineKeyboard: msg.inlineKeyboard,
      });

      await prisma.emergencyScheduledAlert.update({
        where: { id: alert.id },
        data:  { status: "sent", sentAt: new Date() },
      });
      await prisma.emergencyAlertSession.update({
        where: { id: sess.id },
        data:  { alertsSent: { increment: 1 } },
      });
      processed++;
    } catch (e) {
      console.error("[emergency-queue] alert", alert.id, e);
    }
  }

  return NextResponse.json({ success: true, processed });
}
