// 백테스트 가상 진입
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const { sessionId, side, entryPrice, size, leverage = 1, entryTime, stopLoss, takeProfit } = await req.json();
    if (!sessionId || !side || !entryPrice || !size || !entryTime) {
      return NextResponse.json({ success: false, message: "필수 항목이 빠졌습니다" }, { status: 400 });
    }

    const btSession = await prisma.backtestSession.findUnique({ where: { id: sessionId } });
    if (!btSession || btSession.userId !== session.user.id) {
      return NextResponse.json({ success: false, message: "없는 세션입니다" }, { status: 404 });
    }

    const trade = await prisma.backtestTrade.create({
      data: {
        sessionId, side, entryPrice, size, leverage,
        entryTime: BigInt(entryTime),
        stopLoss: stopLoss ?? null,
        takeProfit: takeProfit ?? null,
        status: "open",
      },
    });

    return NextResponse.json({ success: true, data: { ...trade, entryTime: Number(trade.entryTime) } });
  } catch (error) {
    console.error("[backtest/trades POST]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}
