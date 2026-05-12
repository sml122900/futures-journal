// 거래소 통합 종료 포지션 내역 조회 API
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createExchangeForUser } from "@/lib/exchanges";
import type { ExchangeId } from "@/lib/exchanges";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const exchange = (searchParams.get("exchange") ?? "bitget") as ExchangeId;
    const inst = await createExchangeForUser(session.user.id, exchange);
    if (!inst) {
      return NextResponse.json({ success: false, message: "API 키를 먼저 등록해주세요" }, { status: 400 });
    }

    const startTime  = parseInt(searchParams.get("startTime") ?? "0");
    const endTime    = parseInt(searchParams.get("endTime") ?? String(Date.now()));
    const limit      = parseInt(searchParams.get("limit") ?? "100");
    const idLessThan = searchParams.get("idLessThan") ?? undefined;

    const list = await inst.getClosedPositions({ startTime, endTime, limit, idLessThan });

    // Bitget /api/bitget/position-history 와 동일한 응답 구조
    return NextResponse.json({ success: true, data: { data: { list } } });
  } catch (error) {
    console.error("[exchange/position-history]", error);
    return NextResponse.json({ success: false, message: "포지션 내역 조회 실패" }, { status: 500 });
  }
}
