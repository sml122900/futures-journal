// 심리 일기 수정 / 삭제
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const { id } = await params;
    const { content, mood, tags } = await req.json();

    const existing = await prisma.tradingDiary.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ success: false, message: "없는 일기입니다" }, { status: 404 });
    }

    const diary = await prisma.tradingDiary.update({
      where: { id },
      data: {
        ...(content !== undefined ? { content: content.trim() } : {}),
        ...(mood    !== undefined ? { mood } : {}),
        ...(tags    !== undefined ? { tags } : {}),
      },
    });

    return NextResponse.json({ success: true, data: diary });
  } catch (error) {
    console.error("[diaries PUT]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.tradingDiary.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ success: false, message: "없는 일기입니다" }, { status: 404 });
    }

    await prisma.tradingDiary.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[diaries DELETE]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}
