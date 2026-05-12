// 백테스트 세션 상세 / 삭제
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

function serializeSession(s: Parameters<typeof Object.assign>[0]) {
  return JSON.parse(JSON.stringify(s, (_key, val) =>
    typeof val === 'bigint' ? Number(val) : val
  ));
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const { id } = await params;
    const btSession = await prisma.backtestSession.findUnique({
      where: { id },
      include: { trades: { orderBy: { entryTime: "asc" } } },
    });
    if (!btSession || btSession.userId !== session.user.id) {
      return NextResponse.json({ success: false, message: "없는 세션입니다" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: serializeSession(btSession) });
  } catch (error) {
    console.error("[backtest/sessions GET]", error);
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
    const btSession = await prisma.backtestSession.findUnique({ where: { id } });
    if (!btSession || btSession.userId !== session.user.id) {
      return NextResponse.json({ success: false, message: "없는 세션입니다" }, { status: 404 });
    }

    await prisma.backtestSession.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[backtest/sessions DELETE]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}
