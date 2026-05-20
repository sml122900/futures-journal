// POST /api/emergency-check — Chrome 확장에서 주문 직전 위험도 체크
import { NextRequest, NextResponse } from "next/server";
import { authenticateExtension } from "@/lib/extension-auth";
import { checkAllTriggers, updateLastPositionEntry } from "@/lib/trigger-checker";
import prisma from "@/lib/prisma";
import { startEmergencySequence } from "@/lib/emergency-scheduler";

export async function POST(req: NextRequest) {
  try {
    const [user, body] = await Promise.all([
      authenticateExtension(req),
      req.json(),
    ]);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { symbol, side, size, exchange = "bitget", source = "chrome-extension" } = body;
    if (!symbol || !side || size === undefined) {
      return NextResponse.json({ error: "symbol, side, size 필요" }, { status: 400 });
    }

    const orderInfo = { exchange, symbol: String(symbol), side: String(side), size: Number(size) };
    // 현재 포지션 목록 (max_total_position, max_single_loss 체크용)
    const decision = await checkAllTriggers(user.id, [], source, orderInfo);

    if (decision.level === 0) {
      return NextResponse.json({ level: 0, sessionId: null, triggers: [], forceSentence: decision.forceSentence });
    }

    // lastPositionEntryAt 갱신 (min_interval용)
    updateLastPositionEntry(user.id).catch(() => {});

    // 세션 생성
    const triggersJson = decision.triggers as unknown as import("@prisma/client").Prisma.InputJsonValue;
    const session = await prisma.emergencyAlertSession.create({
      data: {
        userId:         user.id,
        positionId:     null,
        source,
        exchange,
        symbol:         String(symbol),
        side:           String(side),
        size:           Number(size),
        sizeMultiplier: 0,
        level:          decision.level,
        triggers:       triggersJson,
        context:        triggersJson,
        forceSentence:  decision.forceSentence,
      },
    });

    // 텔레그램 알림 (non-blocking)
    startEmergencySequence(user.id, {
      positionId: session.id,
      exchange,
      symbol: String(symbol),
      side:   String(side) as "long" | "short",
      size:   Number(size),
    }, decision).catch(() => {});

    return NextResponse.json({
      level:           decision.level,
      sessionId:       session.id,
      triggers:        decision.triggers.map(t => t.message),
      forceSentence:   decision.forceSentence,
      countdownSeconds: [0, 10, 30, 60][decision.level],
    });
  } catch (e) {
    console.error("[emergency-check POST]", e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
