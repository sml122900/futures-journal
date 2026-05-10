// 리스크 모니터 실시간 지표 API (오늘 거래 통계 + 쿨다운/한도 상태)
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getDecryptedCredentials, bitgetRequest } from "@/lib/bitget";

/**
 * GET /api/rules/status
 * 오늘 포지션 통계 + 활성 룰 기준 위험 지표 반환
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const userId = session.user.id;

    // 활성 룰 조회
    const rules = await prisma.tradingRule.findMany({
      where: { userId, enabled: true },
    });

    const hasDailyLimit = rules.find((r) => r.type === "daily_limit");
    const hasCooldown   = rules.find((r) => r.type === "cooldown");

    // 오늘 0시(UTC) 기준
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    // Bitget 자격증명 없으면 기본값만 반환
    const credentials = await getDecryptedCredentials(userId);
    if (!credentials) {
      return NextResponse.json({
        success: true,
        data: {
          todayTrades: 0, todayPnl: 0, todayMargin: 0,
          lastTradeMinutesAgo: null,
          dailyLimitPct: null, cooldownRemainingMin: null,
        },
      });
    }

    // 오늘 종료 포지션 조회
    const res = await bitgetRequest(credentials, "GET", "/api/v2/mix/position/history-position", {
      productType: "USDT-FUTURES",
      limit: "100",
      startTime: String(todayStart.getTime()),
      endTime: String(Date.now()),
    });

    const list = (res?.data?.list ?? []) as Record<string, string>[];

    const todayTrades = list.length;
    let todayPnl = 0;
    let todayMargin = 0;
    let latestCloseMs = 0;

    for (const p of list) {
      todayPnl   += parseFloat(p.netProfit  || "0");
      todayMargin += parseFloat(p.marginSize || "0");
      const ct = parseInt(p.closeTime || "0");
      if (ct > latestCloseMs) latestCloseMs = ct;
    }

    // 마지막 거래 경과 시간 (분)
    const lastTradeMinutesAgo = latestCloseMs
      ? Math.floor((Date.now() - latestCloseMs) / 60000)
      : null;

    // 일일 한도 진행도 (%)
    let dailyLimitPct: number | null = null;
    if (hasDailyLimit && todayMargin > 0 && todayPnl < 0) {
      const cfg = hasDailyLimit.config as Record<string, number>;
      const lossRatio = Math.abs(todayPnl) / todayMargin * 100;
      dailyLimitPct = parseFloat(((lossRatio / cfg.lossPercent) * 100).toFixed(1));
    }

    // 쿨다운 잔여 시간 (분)
    let cooldownRemainingMin: number | null = null;
    if (hasCooldown && lastTradeMinutesAgo !== null) {
      const cfg = hasCooldown.config as Record<string, unknown>;
      const cooldownMin = cfg.minutes as number;
      const after = cfg.after as string;

      // "loss" 쿨다운: 마지막 거래가 손실일 때만 적용
      let applyCD = after === "any";
      if (after === "loss" && list.length > 0) {
        const lastTrade = list.reduce((a, b) =>
          parseInt(a.closeTime || "0") > parseInt(b.closeTime || "0") ? a : b
        );
        applyCD = parseFloat(lastTrade.netProfit || "0") < 0;
      }

      if (applyCD) {
        const remaining = cooldownMin - lastTradeMinutesAgo;
        cooldownRemainingMin = remaining > 0 ? remaining : 0;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        todayTrades,
        todayPnl: parseFloat(todayPnl.toFixed(2)),
        todayMargin: parseFloat(todayMargin.toFixed(2)),
        lastTradeMinutesAgo,
        dailyLimitPct,
        cooldownRemainingMin,
      },
    });
  } catch (error) {
    console.error("[rules/status GET]", error);
    // 에러 시 기본값 반환 (위젯이 에러로 깨지지 않도록)
    return NextResponse.json({
      success: true,
      data: {
        todayTrades: 0, todayPnl: 0, todayMargin: 0,
        lastTradeMinutesAgo: null,
        dailyLimitPct: null, cooldownRemainingMin: null,
      },
    });
  }
}
