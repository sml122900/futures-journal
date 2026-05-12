// 백테스트 세션 목록 / 생성
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const sessions = await prisma.backtestSession.findMany({
      where: { userId: session.user.id },
      include: { trades: { select: { id: true, status: true, pnl: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: sessions });
  } catch (error) {
    console.error("[backtest/sessions GET]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const { name, symbol, startTime, endTime, initialSeed = 1000 } = await req.json();
    if (!name || !symbol || !startTime || !endTime) {
      return NextResponse.json({ success: false, message: "필수 항목이 빠졌습니다" }, { status: 400 });
    }

    const btSession = await prisma.backtestSession.create({
      data: {
        userId: session.user.id,
        name, symbol,
        startTime: BigInt(startTime),
        endTime:   BigInt(endTime),
        initialSeed,
      },
    });

    return NextResponse.json({ success: true, data: { ...btSession, startTime: Number(btSession.startTime), endTime: Number(btSession.endTime) } });
  } catch (error) {
    console.error("[backtest/sessions POST]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}
