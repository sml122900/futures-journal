// 거래소 통합 잔고 조회 API
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

    const balance = await inst.getBalance();

    // 청산 위험 감지: crossedRiskRate >= 0.7이면 알림
    try {
      const riskRate = parseFloat(String(balance.crossedRiskRate ?? 0));
      if (riskRate >= 0.7) {
        const { notifyLiquidationRisk } = await import("@/lib/notifications");
        notifyLiquidationRisk(session.user.id, {
          symbol: "전체 계좌",
          mmr: riskRate,
          liqPrice: 0,
          currentPrice: 0,
        }).catch(() => {});
      }
    } catch { /* 알림 실패해도 응답에 영향 없음 */ }

    // Bitget /api/bitget/balance 와 동일한 응답 구조: { data: { data: [balance] } }
    return NextResponse.json({ success: true, data: { data: [balance] } });
  } catch (error) {
    console.error("[exchange/balance]", error);
    return NextResponse.json({ success: false, message: "잔고 조회 실패" }, { status: 500 });
  }
}
