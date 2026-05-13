// 텔레그램 연동 해제
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    await prisma.notificationSetting.updateMany({
      where: { userId: session.user.id },
      data: { telegramChatId: null, telegramLinked: false },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[telegram/unlink]", err);
    return NextResponse.json({ success: false, message: "해제 실패" }, { status: 500 });
  }
}
