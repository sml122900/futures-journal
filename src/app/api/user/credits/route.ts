// 크레딧 잔액 조회
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { credits: true },
    });
    return NextResponse.json({ success: true, data: { credits: user?.credits ?? 0 } });
  } catch (error) {
    console.error("[credits GET]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}
