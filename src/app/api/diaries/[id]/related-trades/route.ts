// 일기 시각 ±3시간 내 포지션 메모 조회
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { linkPositionsToDiary } from "@/lib/diary-linker";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const { id } = await params;
    const diary = await prisma.tradingDiary.findUnique({ where: { id } });
    if (!diary || diary.userId !== session.user.id) {
      return NextResponse.json({ success: false, message: "없는 일기입니다" }, { status: 404 });
    }

    const memos = await linkPositionsToDiary(session.user.id, diary.createdAt);
    return NextResponse.json({ success: true, data: memos });
  } catch (error) {
    console.error("[diaries/related-trades]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}
