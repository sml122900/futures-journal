// POST /api/emergency-check — Chrome 확장에서 주문 직전 위험도 체크

import { NextRequest, NextResponse } from "next/server";
import { authenticateExtension } from "@/lib/extension-auth";
import { computeEmergency } from "@/lib/emergency-detector";
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
    // ① Batch 1: 인증 + body 파싱 (병렬 — 헤더/body 독립적으로 읽을 수 있음)
    const [user, body] = await Promise.all([
      authenticateExtension(req),
      req.json(),
    ]);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    lap("auth+body");

    const { symbol, side, size, exchange = "bitget", source = "chrome-extension" } = body;
    if (!symbol || !side || !size) {
      return NextResponse.json({ error: "symbol, side, size 필요" }, { status: 400 });
    }

    // ② Batch 2: setting + baseline + activeRest (병렬 — 모두 userId만 필요)
    const [setting, baseline, activeRest] = await Promise.all([
      prisma.emergencySetting.findUnique({ where: { userId: user.id } }),
      prisma.userBaseline.findUnique({ where: { userId_exchange: { userId: user.id, exchange } } }),
      prisma.restDeclaration.findFirst({ where: { userId: user.id, expiresAt: { gt: new Date() }, cancelledAt: null } }),
    ]);
    lap("setting+baseline+rest");

    if (setting?.enabled === false) {
      return NextResponse.json({ level: 0, sessionId: null });
    }
    if (setting?.pausedUntil && setting.pausedUntil > new Date()) {
      return NextResponse.json({ level: 0, sessionId: null });
    }

    // ③ 순수 계산 (DB 쿼리 없음)
    const decision = computeEmergency(
      { exchange, symbol, side, size: Number(size), openedAt: Date.now() },
      { baseline, setting, activeRest }
    );
    lap(`compute level=${decision.level}`);

    if (decision.level === 0) {
      return NextResponse.json({ level: 0, sessionId: null });
    }

    const forceSentence = setting?.customMessage || "원칙을 지켜야 살아남는다";

    // ④ Batch 3: 과거 패턴 조회 + 세션 생성 (병렬 — level > 0일 때만)
    const [pastSessions, session] = await Promise.all([
      prisma.emergencyAlertSession.findMany({
        where: {
          userId: user.id,
          startedAt: { gt: new Date(Date.now() - 90 * 24 * 3600_000) },
          userAction: { in: ["kept", "ignored", "user_closing"] },
        },
        select: { id: true },
      }),
      prisma.emergencyAlertSession.create({
        data: {
          userId:         user.id,
          positionId:     null,
          source,
          exchange,
          symbol:         String(symbol),
          side:           String(side),
          size:           Number(size),
          sizeMultiplier: decision.context.sizeMultiplier,
          level:          decision.level,
          triggers:       decision.triggers,
          context:        decision.context as object,
          forceSentence,
        },
      }),
    ]);
    lap("pastSessions+session");

    const pastSimilarCount = pastSessions.length > 0 ? pastSessions.length : undefined;
    const triggerLabels = decision.triggers.map(t => TRIGGER_LABELS[t] ?? t);
    const pastPattern = pastSimilarCount
      ? `최근 90일간 유사 상황 ${pastSimilarCount}회 발동`
      : undefined;

    return NextResponse.json({
      level:            decision.level,
      sessionId:        session.id,
      triggers:         triggerLabels,
      pastPattern,
      forceSentence,
      countdownSeconds: [0, 10, 30, 60][decision.level],
    });
  } catch (e) {
    console.error("[emergency-check POST]", e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
