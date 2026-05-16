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
      const setting = await (await import("@/lib/prisma")).default.emergencySetting.findUnique({
        where: { userId: session.user.id },
      });
      if (setting?.enabled !== false) {
        const isPaused = setting?.pausedUntil && new Date(setting.pausedUntil) > new Date();

        // 작동 시간대 체크 (activeHoursOnly 활성 시)
        let isInActiveWindow = true;
        if (setting?.activeHoursOnly) {
          const nowHour = new Date().getHours(); // 로컬 시간 (서버 UTC 기준)
          const s = setting.activeHourStart;
          const e = setting.activeHourEnd;
          isInActiveWindow = s <= e
            ? nowHour >= s && nowHour < e
            : nowHour >= s || nowHour < e; // 자정 걸친 경우 (예: 22~4)
        }

        if (!isPaused && isInActiveWindow) {
          const FRESH_MS = 30_000; // 30초 이내 진입한 포지션만 신규로 간주
          for (const pos of positions) {
            const size = parseFloat(String(pos.marginSize ?? pos.initialMargin ?? 0));
            const posId = String(pos.positionId ?? pos.marginCoin ?? pos.symbol ?? "");
            const openedAt = parseInt(String(pos.openTime ?? pos.openTimeStamp ?? Date.now()));
            const side = (String(pos.holdSide ?? pos.positionSide ?? "long").toLowerCase() === "short") ? "short" : "long";
            if (size <= 0 || !posId) continue;

            // 30초 이내 진입한 포지션만 Emergency 발동
            if (Date.now() - openedAt > FRESH_MS) continue;

            const { detectEmergency } = await import("@/lib/emergency-detector");
            const { startEmergencySequence } = await import("@/lib/emergency-scheduler");

            const decision = await detectEmergency(session.user.id, {
              exchange, symbol: String(pos.symbol ?? ""), side, size, openedAt,
            });

            if (decision.level >= 1) {
              // 5분 내 중복 발동 방지
              const prisma = (await import("@/lib/prisma")).default;
              const recent = await prisma.emergencyAlertSession.findFirst({
                where: {
                  userId: session.user.id,
                  positionId: posId,
                  startedAt: { gt: new Date(Date.now() - 5 * 60_000) },
                },
              });
              if (!recent) {
                startEmergencySequence(session.user.id, { positionId: posId, exchange, symbol: String(pos.symbol ?? ""), side, size }, decision).catch(() => {});
              }
            }
          }
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
