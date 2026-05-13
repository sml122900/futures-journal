// 알림 설정 조회 / 수정
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const DEFAULT_SETTINGS = {
  telegramLinked: false,
  telegramChatId: null as string | null,
  emailEnabled: true,
  ruleViolation: true,
  largeLoss: true,
  liquidationRisk: true,
  memoReminder: false,
  weeklyReport: true,
  milestoneAlert: true,
};

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const ns = await prisma.notificationSetting.findUnique({
      where: { userId: session.user.id },
      select: {
        telegramLinked: true, telegramChatId: true, emailEnabled: true,
        ruleViolation: true, largeLoss: true, liquidationRisk: true,
        memoReminder: true, weeklyReport: true, milestoneAlert: true,
      },
    });

    return NextResponse.json({ success: true, settings: ns ?? DEFAULT_SETTINGS });
  } catch (err) {
    console.error("[notifications/settings] GET", err);
    return NextResponse.json({ success: false, message: "조회 실패" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const body = await req.json();
    const fields = ["emailEnabled", "ruleViolation", "largeLoss", "liquidationRisk", "memoReminder", "weeklyReport", "milestoneAlert"] as const;
    const data: Partial<Record<(typeof fields)[number], boolean>> = {};
    for (const f of fields) {
      if (body[f] !== undefined) data[f] = Boolean(body[f]);
    }

    const updated = await prisma.notificationSetting.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, ...data },
      update: data,
    });

    return NextResponse.json({ success: true, settings: updated });
  } catch (err) {
    console.error("[notifications/settings] PUT", err);
    return NextResponse.json({ success: false, message: "저장 실패" }, { status: 500 });
  }
}
