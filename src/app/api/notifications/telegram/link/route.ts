// 텔레그램 연동 코드 생성 및 연동 상태 조회
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateLinkCode, getBotInfo } from "@/lib/telegram";

export async function POST(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const code = generateLinkCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.notificationSetting.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, linkCode: code, linkCodeExpiresAt: expiresAt },
      update: { linkCode: code, linkCodeExpiresAt: expiresAt },
    });

    const botInfo = await getBotInfo();
    return NextResponse.json({
      success: true,
      code,
      botUsername: botInfo?.username ?? "",
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    console.error("[telegram/link] POST", err);
    return NextResponse.json({ success: false, message: "코드 생성 실패" }, { status: 500 });
  }
}

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const ns = await prisma.notificationSetting.findUnique({
      where: { userId: session.user.id },
      select: { telegramLinked: true, telegramChatId: true },
    });

    return NextResponse.json({
      success: true,
      linked: ns?.telegramLinked ?? false,
      chatId: ns?.telegramChatId ?? null,
    });
  } catch (err) {
    console.error("[telegram/link] GET", err);
    return NextResponse.json({ success: false, message: "조회 실패" }, { status: 500 });
  }
}
