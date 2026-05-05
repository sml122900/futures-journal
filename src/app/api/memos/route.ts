// 메모 조회/생성(upsert) API
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/** 내 메모 전체 조회 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const memos = await prisma.memo.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ success: true, data: memos });
  } catch (error) {
    console.error("[memos GET]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}

/** 메모 생성/수정 (positionId 기준 upsert) */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const { positionId, reason, psych, external, text } = await req.json();

    if (!positionId) {
      return NextResponse.json(
        { success: false, message: "positionId는 필수입니다" },
        { status: 400 }
      );
    }

    const memo = await prisma.memo.upsert({
      where: {
        userId_positionId: { userId: session.user.id, positionId },
      },
      create: {
        userId: session.user.id,
        positionId,
        reason: reason ?? "",
        psych: psych ?? "",
        external: external ?? "",
        text: text ?? "",
      },
      update: {
        reason: reason ?? "",
        psych: psych ?? "",
        external: external ?? "",
        text: text ?? "",
      },
    });

    return NextResponse.json({ success: true, data: memo });
  } catch (error) {
    console.error("[memos POST]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}
