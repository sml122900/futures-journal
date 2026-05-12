// 거래소 통합 캔들 데이터 조회 API
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createExchangeForUser } from "@/lib/exchanges";
import type { ExchangeId } from "@/lib/exchanges";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const exchange = (searchParams.get("exchange") ?? "bitget") as ExchangeId;
    const inst = await createExchangeForUser(session.user.id, exchange);
    if (!inst) {
      return NextResponse.json({ success: false, message: "API 키 필요" }, { status: 400 });
    }

    const symbol = searchParams.get("symbol") ?? "";
    const tf     = searchParams.get("tf") ?? "5m";
    const from   = parseInt(searchParams.get("from") ?? "0");
    const to     = parseInt(searchParams.get("to") ?? String(Date.now()));

    const candles = await inst.getCandles(symbol, tf, { startTime: from, endTime: to });
    return NextResponse.json({ success: true, candles });
  } catch (err) {
    console.error("[exchange/candles]", err);
    return NextResponse.json({ success: false, message: "캔들 조회 실패" }, { status: 500 });
  }
}
