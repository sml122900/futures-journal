// GET /api/emergency-check/baseline
// Chrome 확장이 로컬 사전 체크에 사용할 UserBaseline + 임계값 반환

import { NextRequest, NextResponse } from "next/server";
import { authenticateExtension } from "@/lib/extension-auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = await authenticateExtension(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [baseline, setting] = await Promise.all([
    prisma.userBaseline.findFirst({
      where: { userId: user.id, exchange: "bitget" },
      select: {
        avgPositionSize: true,
        medianPositionSize: true,
        sampleSize: true,
      },
    }),
    prisma.emergencySetting.findUnique({
      where: { userId: user.id },
      select: {
        enabled: true,
        level1Threshold: true,
        level2Threshold: true,
        level3Threshold: true,
        pausedUntil: true,
      },
    }),
  ]);

  const isPaused = setting?.pausedUntil && setting.pausedUntil > new Date();

  return NextResponse.json({
    avgPositionSize:    baseline?.avgPositionSize ?? 0,
    medianPositionSize: baseline?.medianPositionSize ?? 0,
    sampleSize:         baseline?.sampleSize ?? 0,
    level1Threshold:    setting?.level1Threshold ?? 1.5,
    level2Threshold:    setting?.level2Threshold ?? 2.0,
    level3Threshold:    setting?.level3Threshold ?? 5.0,
    enabled:            (setting?.enabled ?? true) && !isPaused,
  });
}
