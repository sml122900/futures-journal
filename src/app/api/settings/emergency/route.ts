// Emergency Brake 설정 조회/수정 API
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const DEFAULT_SETTING = {
  enabled: true,
  level1Threshold: 1.5,
  level2Threshold: 2.0,
  level3Threshold: 5.0,
  activeHoursOnly: false,
  activeHourStart: 0,
  activeHourEnd:   23,
  customMessage:   null,
  pausedUntil:     null,
  pauseReason:     null,
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const setting = await prisma.emergencySetting.findUnique({ where: { userId: session.user.id } });
  return NextResponse.json({ setting: setting ?? DEFAULT_SETTING });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    enabled, level1Threshold, level2Threshold, level3Threshold,
    activeHoursOnly, activeHourStart, activeHourEnd,
    customMessage, pausedUntil, pauseReason,
  } = body;

  const data: Record<string, unknown> = {};
  if (enabled        !== undefined) data.enabled        = Boolean(enabled);
  if (level1Threshold !== undefined) data.level1Threshold = Number(level1Threshold);
  if (level2Threshold !== undefined) data.level2Threshold = Number(level2Threshold);
  if (level3Threshold !== undefined) data.level3Threshold = Number(level3Threshold);
  if (activeHoursOnly !== undefined) data.activeHoursOnly = Boolean(activeHoursOnly);
  if (activeHourStart !== undefined) data.activeHourStart = Number(activeHourStart);
  if (activeHourEnd   !== undefined) data.activeHourEnd   = Number(activeHourEnd);
  if (customMessage   !== undefined) data.customMessage   = customMessage || null;
  if (pausedUntil     !== undefined) data.pausedUntil     = pausedUntil ? new Date(pausedUntil) : null;
  if (pauseReason     !== undefined) data.pauseReason     = pauseReason || null;

  const setting = await prisma.emergencySetting.upsert({
    where:  { userId: session.user.id },
    create: { userId: session.user.id, ...DEFAULT_SETTING, ...data },
    update: data,
  });

  return NextResponse.json({ setting });
}
