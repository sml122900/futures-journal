// 메모 삭제 API
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/** 메모 삭제 (본인 메모만 삭제 가능) */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const { id } = await params;

    const memo = await prisma.memo.findUnique({ where: { id } });
    if (!memo) {
      return NextResponse.json({ success: false, message: "메모를 찾을 수 없습니다" }, { status: 404 });
    }
    if (memo.userId !== session.user.id) {
      return NextResponse.json({ success: false, message: "권한 없음" }, { status: 403 });
    }

    await prisma.memo.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "삭제 완료" });
  } catch (error) {
    console.error("[memos DELETE]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}
