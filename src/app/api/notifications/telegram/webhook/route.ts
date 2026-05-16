// 텔레그램 Webhook 수신 핸들러
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendTelegramMessage, answerCallbackQuery } from "@/lib/telegram";

const APP_URL = process.env.NEXTAUTH_URL ?? "https://futures-journal.vercel.app";

/** MarkdownV2 특수문자 이스케이프 */
function esc(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

interface TgMessage {
  from?: { id: number; first_name?: string };
  chat: { id: number };
  text?: string;
}

interface TgCallbackQuery {
  id: string;
  from: { id: number };
  data?: string;
}

interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  callback_query?: TgCallbackQuery;
}

export async function POST(req: NextRequest) {
  try {
    const body: TgUpdate = await req.json();

    // callback_query 처리 (인라인 버튼 클릭)
    if (body.callback_query) {
      const cq = body.callback_query;
      const data = cq.data ?? "";
      const fromChatId = String(cq.from.id);

      const setting = await prisma.notificationSetting.findFirst({
        where: { telegramChatId: fromChatId },
      });
      if (setting) {
        if (data.startsWith("emergency_close_")) {
          const sessionId = data.replace("emergency_close_", "");
          const sess = await prisma.emergencyAlertSession.findUnique({ where: { id: sessionId } });
          if (sess && sess.userId === setting.userId && !sess.cancelledAt) {
            await prisma.emergencyAlertSession.update({
              where: { id: sessionId },
              data:  { userAction: "user_closing", cancelledAt: new Date() },
            });
            await prisma.emergencyScheduledAlert.updateMany({
              where: { sessionId, status: "pending" },
              data:  { status: "cancelled" },
            });
            await answerCallbackQuery(cq.id, "잘 결정하셨습니다. 비트겟 앱으로 이동해서 청산하세요.");
          } else {
            await answerCallbackQuery(cq.id);
          }
        } else if (data.startsWith("emergency_keep_")) {
          const sessionId = data.replace("emergency_keep_", "");
          const sess = await prisma.emergencyAlertSession.findUnique({ where: { id: sessionId } });
          if (sess && sess.userId === setting.userId) {
            await prisma.emergencyAlertSession.update({
              where: { id: sessionId },
              data:  { userAction: "kept" },
            });
            await answerCallbackQuery(cq.id, "이 매매는 사후 회고 대상으로 기록됩니다.");
          } else {
            await answerCallbackQuery(cq.id);
          }
        } else {
          await answerCallbackQuery(cq.id);
        }
      } else {
        await answerCallbackQuery(cq.id);
      }
      return NextResponse.json({ ok: true });
    }

    const message = body.message;
    if (!message?.text) return NextResponse.json({ ok: true });

    const chatId = String(message.chat.id);
    const text = message.text.trim();
    const firstName = message.from?.first_name ?? "사용자";

    if (text.startsWith("/start")) {
      await sendTelegramMessage(
        chatId,
        `👋 안녕하세요, *${esc(firstName)}*님\\!\n\nFutures Journal 봇입니다\\.\n\n계정 연동 후 다음 알림을 받을 수 있습니다:\n• 룰 위반 감지\n• 큰 손실 알림\n• 청산 위험 경고\n• 주간 리포트\n• 마일스톤 달성\n\n연동하려면 앱에서 연동 코드를 받아 \`/link 코드\` 를 입력해주세요\\.`,
        { parseMode: "MarkdownV2" }
      );
    } else if (text.startsWith("/link ")) {
      const code = text.slice(6).trim().toUpperCase();
      const ns = await prisma.notificationSetting.findFirst({
        where: {
          linkCode: code,
          linkCodeExpiresAt: { gt: new Date() },
          telegramLinked: false,
        },
      });

      if (!ns) {
        await sendTelegramMessage(
          chatId,
          "❌ 코드가 유효하지 않거나 만료되었습니다\\.\n앱에서 새 코드를 발급받아 주세요\\.",
          { parseMode: "MarkdownV2" }
        );
        return NextResponse.json({ ok: true });
      }

      await prisma.notificationSetting.update({
        where: { id: ns.id },
        data: { telegramChatId: chatId, telegramLinked: true, linkCode: null, linkCodeExpiresAt: null },
      });

      await sendTelegramMessage(
        chatId,
        `✅ *연동 완료\\!*\n\nFutures Journal 계정과 연동됐습니다\\.\n이제 중요한 알림을 실시간으로 받을 수 있어요\\!`,
        {
          parseMode: "MarkdownV2",
          inlineKeyboard: [[{ text: "⚙️ 알림 설정 변경", url: `${APP_URL}/settings/notifications` }]],
        }
      );
    } else if (text === "/status") {
      const ns = await prisma.notificationSetting.findFirst({
        where: { telegramChatId: chatId },
      });
      if (ns?.telegramLinked) {
        await sendTelegramMessage(
          chatId,
          `✅ *연동 상태: 정상*\n\n모든 알림이 활성화되어 있습니다\\.`,
          {
            parseMode: "MarkdownV2",
            inlineKeyboard: [[{ text: "⚙️ 알림 설정 변경", url: `${APP_URL}/settings/notifications` }]],
          }
        );
      } else {
        await sendTelegramMessage(
          chatId,
          "❌ 연동된 계정이 없습니다\\. 앱에서 연동 코드를 받아 \`/link 코드\` 를 입력해주세요\\.",
          { parseMode: "MarkdownV2" }
        );
      }
    } else if (text === "/unlink") {
      const ns = await prisma.notificationSetting.findFirst({
        where: { telegramChatId: chatId },
      });
      if (ns) {
        await prisma.notificationSetting.update({
          where: { id: ns.id },
          data: { telegramChatId: null, telegramLinked: false },
        });
        await sendTelegramMessage(chatId, "✅ 연동이 해제되었습니다\\.", { parseMode: "MarkdownV2" });
      } else {
        await sendTelegramMessage(chatId, "연동된 계정이 없습니다\\.", { parseMode: "MarkdownV2" });
      }
    } else if (text === "/help") {
      await sendTelegramMessage(
        chatId,
        `*Futures Journal 봇 도움말*\n\n/start \\- 시작하기\n/link 코드 \\- 계정 연동\n/status \\- 연동 상태 확인\n/unlink \\- 연동 해제\n/help \\- 도움말`,
        { parseMode: "MarkdownV2" }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[telegram/webhook]", err);
    return NextResponse.json({ ok: true }); // 텔레그램에는 항상 200 반환
  }
}
