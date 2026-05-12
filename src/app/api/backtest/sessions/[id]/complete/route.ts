// 백테스트 세션 완료 처리
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const updated = await prisma.backtestSession.update({
      where: { id },
      data: { status: "completed", completedAt: new Date() },
    });

    return NextResponse.json({ success: true, data: { ...updated, startTime: Number(updated.startTime), endTime: Number(updated.endTime) } });
  } catch (error) {
    console.error("[backtest/complete]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}
