// 거래소 통합 현재 오픈 포지션 조회 API
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

    const exchange = (req.nextUrl.searchParams.get("exchange") ?? "bitget") as ExchangeId;
    const inst = await createExchangeForUser(session.user.id, exchange);
    if (!inst) {
      return NextResponse.json({ success: false, message: "API 키를 먼저 등록해주세요" }, { status: 400 });
    }

    const positions = await inst.getPositions();
    // Bitget /api/bitget/positions 와 동일한 응답 구조: { data: { data: [...] } }
    return NextResponse.json({ success: true, data: { data: positions } });
  } catch (error) {
    console.error("[exchange/positions]", error);
    return NextResponse.json({ success: false, message: "포지션 조회 실패" }, { status: 500 });
  }
}
