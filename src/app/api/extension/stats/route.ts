// GET /api/extension/stats — 팝업용 통계 (Bearer 토큰 인증)

import { NextRequest, NextResponse } from "next/server";
import { authenticateExtension } from "@/lib/extension-auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = await authenticateExtension(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [thisMonthCount, lastSession] = await Promise.all([
    prisma.emergencyAlertSession.count({
      where: {
        userId: user.id,
        source: "chrome-extension",
        startedAt: { gte: monthStart },
      },
    }),
    prisma.emergencyAlertSession.findFirst({
      where: { userId: user.id, source: "chrome-extension" },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true },
    }),
  ]);

  return NextResponse.json({
    email: user.email,
    thisMonthCount,
    lastTriggeredAt: lastSession?.startedAt ?? null,
  });
}
