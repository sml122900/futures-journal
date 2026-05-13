// 테스트 알림 발송
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";

export async function POST(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const ns = await prisma.notificationSetting.findUnique({
      where: { userId: session.user.id },
    });

    if (!ns?.telegramLinked || !ns.telegramChatId) {
      return NextResponse.json({ success: false, message: "텔레그램 연동이 필요합니다" }, { status: 400 });
    }

    const sent = await sendTelegramMessage(
      ns.telegramChatId,
      `🔔 *테스트 알림*\n\nFutures Journal 알림이 정상적으로 설정되었습니다\\!\n이 메시지가 보이면 연동이 완료된 것입니다\\. ✅`,
      { parseMode: "MarkdownV2" }
    );

    if (!sent) {
      return NextResponse.json({ success: false, message: "발송 실패" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[notifications/test]", err);
    return NextResponse.json({ success: false, message: "테스트 발송 실패" }, { status: 500 });
  }
}
