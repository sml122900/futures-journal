// 백테스트 가상 청산 (PnL 계산 포함)
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const FEE_RATE = 0.0004; // 0.04% 고정 수수료

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const { id } = await params;
    const trade = await prisma.backtestTrade.findUnique({
      where: { id },
      include: { session: true },
    });

    if (!trade || trade.session.userId !== session.user.id) {
      return NextResponse.json({ success: false, message: "없는 거래입니다" }, { status: 404 });
    }
    if (trade.status !== "open") {
      return NextResponse.json({ success: false, message: "이미 청산된 거래입니다" }, { status: 400 });
    }

    const { exitPrice, exitTime, closeReason } = await req.json();
    if (!exitPrice || !exitTime) {
      return NextResponse.json({ success: false, message: "청산가와 시각이 필요합니다" }, { status: 400 });
    }

    const notional = trade.entryPrice * trade.size;
    const entryFee = notional * FEE_RATE;
    const exitFee  = exitPrice * trade.size * FEE_RATE;
    const rawPnl   = trade.side === "long"
      ? (exitPrice - trade.entryPrice) * trade.size * trade.leverage
      : (trade.entryPrice - exitPrice) * trade.size * trade.leverage;
    const pnl = rawPnl - entryFee - exitFee;

    const updated = await prisma.backtestTrade.update({
      where: { id },
      data: { exitPrice, exitTime: BigInt(exitTime), pnl, status: "closed", closeReason: closeReason ?? null },
    });

    return NextResponse.json({ success: true, data: { ...updated, entryTime: Number(updated.entryTime), exitTime: Number(updated.exitTime) } });
  } catch (error) {
    console.error("[backtest/trades/close]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}
