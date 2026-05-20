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

    // Emergency Brake: 신규 포지션 감지 (non-blocking)
    try {
      const FRESH_MS = 30_000;
      for (const pos of positions) {
        const size    = parseFloat(String(pos.marginSize ?? pos.initialMargin ?? 0));
        const posId   = String(pos.positionId ?? pos.marginCoin ?? pos.symbol ?? "");
        const openedAt = parseInt(String(pos.openTime ?? pos.openTimeStamp ?? Date.now()));
        const side    = (String(pos.holdSide ?? pos.positionSide ?? "long").toLowerCase() === "short") ? "short" : "long";
        if (size <= 0 || !posId) continue;
        if (Date.now() - openedAt > FRESH_MS) continue;

        // 5분 내 중복 발동 방지
        const prismaClient = (await import("@/lib/prisma")).default;
        const recent = await prismaClient.emergencyAlertSession.findFirst({
          where: { userId: session.user.id, positionId: posId, startedAt: { gt: new Date(Date.now() - 5 * 60_000) } },
        });
        if (recent) continue;

        const { checkAllTriggers, updateLastPositionEntry } = await import("@/lib/trigger-checker");
        const { startEmergencySequence } = await import("@/lib/emergency-scheduler");

        const positionSummaries = positions.map(p => ({
          size:          parseFloat(String(p.marginSize ?? p.initialMargin ?? 0)),
          unrealizedPnl: parseFloat(String(p.unrealizedPL ?? p.unrealisedPnl ?? 0)),
        }));

        const decision = await checkAllTriggers(
          session.user.id,
          positionSummaries,
          "android",
          { exchange, symbol: String(pos.symbol ?? ""), side, size }
        );

        if (decision.level >= 1) {
          updateLastPositionEntry(session.user.id).catch(() => {});
          startEmergencySequence(session.user.id, { positionId: posId, exchange, symbol: String(pos.symbol ?? ""), side, size }, decision).catch(() => {});
        }
      }
    } catch { /* Emergency 실패해도 포지션 응답에 영향 없음 */ }

    // Bitget /api/bitget/positions 와 동일한 응답 구조: { data: { data: [...] } }
    return NextResponse.json({ success: true, data: { data: positions } });
  } catch (error) {
    console.error("[exchange/positions]", error);
    return NextResponse.json({ success: false, message: "포지션 조회 실패" }, { status: 500 });
  }
}
