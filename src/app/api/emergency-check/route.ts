// POST /api/emergency-check — Chrome 확장에서 주문 직전 위험도 체크

import { NextRequest, NextResponse } from "next/server";
import { authenticateExtension } from "@/lib/extension-auth";
import { detectEmergency } from "@/lib/emergency-detector";
import prisma from "@/lib/prisma";

const TRIGGER_LABELS: Record<string, string> = {
  size_multiplier_high:     "평소 5배 이상의 거래 사이즈",
  size_multiplier_mid:      "평소 2~5배 거래 사이즈",
  size_multiplier_low:      "평소 1.5~2배 거래 사이즈",
  rest_declared_violated:   "오늘 쉬겠다고 선언한 날",
  consecutive_profit_break: "연속 흑자 중 무리한 사이즈",
  risky_time_window:        "과거 손실이 집중된 시간대",
  risky_day_of_week:        "과거 손실이 집중된 요일",
};

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const lap = (label: string) =>
    console.log(`[emergency-check] ${label}: ${Date.now() - t0}ms`);

  try {
    // ① 인증
    const user = await authenticateExtension(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    lap("auth");

    const body = await req.json();
    const { symbol, side, size, exchange = "bitget", source = "chrome-extension" } = body;

    if (!symbol || !side || !size) {
      return NextResponse.json({ error: "symbol, side, size 필요" }, { status: 400 });
    }

    // ② EmergencySetting 선제 조회 (detectEmergency 내부 중복 방지 + 조기 종료)
    const setting = await prisma.emergencySetting.findUnique({ where: { userId: user.id } });
    lap("setting");

    if (setting?.enabled === false) {
      return NextResponse.json({ level: 0, sessionId: null });
    }
    if (setting?.pausedUntil && setting.pausedUntil > new Date()) {
      return NextResponse.json({ level: 0, sessionId: null });
    }

    // ③ 위험도 판단 (detectEmergency 내부에서 setting 한 번 더 읽지만 캐시됨)
    const decision = await detectEmergency(user.id, {
      exchange,
      symbol,
      side,
      size: Number(size),
      openedAt: Date.now(),
    });
    lap(`detectEmergency level=${decision.level}`);

    if (decision.level === 0) {
      return NextResponse.json({ level: 0, sessionId: null });
    }

    const forceSentence = setting?.customMessage || "원칙을 지켜야 살아남는다";
    const triggerLabels = decision.triggers.map(t => TRIGGER_LABELS[t] ?? t);
    const pastPattern = decision.context.pastSimilarCount
      ? `최근 90일간 유사 상황 ${decision.context.pastSimilarCount}회 발동`
      : undefined;

    // ④ 세션 기록
    const session = await prisma.emergencyAlertSession.create({
      data: {
        userId: user.id,
        positionId: null,
        source,
        exchange,
        symbol:        String(symbol),
        side:          String(side),
        size:          Number(size),
        sizeMultiplier: decision.context.sizeMultiplier,
        level:         decision.level,
        triggers:      decision.triggers,
        context:       decision.context as object,
        forceSentence,
      },
    });
    lap("session create");

    return NextResponse.json({
      level:           decision.level,
      sessionId:       session.id,
      triggers:        triggerLabels,
      pastPattern,
      forceSentence,
      countdownSeconds: [0, 10, 30, 60][decision.level],
    });
  } catch (e) {
    console.error("[emergency-check POST]", e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
