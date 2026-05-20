// GET /api/extension/blocking-status — 크롬 확장 폴링용 현재 차단 상태
import { NextResponse } from "next/server";
import { authenticateExtension } from "@/lib/extension-auth";
import { getActiveBlockingReason } from "@/lib/trigger-checker";
import prisma from "@/lib/prisma";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const user = await authenticateExtension(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // forceSentence 조회
  const setting = await prisma.userTriggerSettings.findUnique({
    where: { userId: user.id },
    select: { forceSentence: true },
  });

  // 상태 기반 체크 (포지션 목록 없이 — no_trade_window, recurring_no_trade 체크)
  const blocking = await getActiveBlockingReason(user.id, []);

  return NextResponse.json({
    isBlocking:   blocking.isBlocking,
    reasons:      blocking.reasons,
    forceSentence: setting?.forceSentence ?? "나는 충동이 아닌 원칙으로 매매할 것을 맹세한다",
  });
}
