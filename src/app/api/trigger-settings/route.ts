// GET/PUT /api/trigger-settings — 사용자 트리거 설정 조회/수정
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const DEFAULT_FORCE_SENTENCE = "나는 충동이 아닌 원칙으로 매매할 것을 맹세한다";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const setting = await prisma.userTriggerSettings.findUnique({
    where: { userId: session.user.id },
  });
  return NextResponse.json({ setting: setting ?? { forceSentence: DEFAULT_FORCE_SENTENCE } });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const body = await req.json();
  const {
    maxTotalPositionEnabled,
    maxTotalPositionUsdt,
    maxSingleLossEnabled,
    maxSingleLossUsdt,
    minIntervalEnabled,
    minIntervalMinutes,
    maxSingleSizeEnabled,
    maxSingleSizeUsdt,
    forceSentence,
  } = body;

  const setting = await prisma.userTriggerSettings.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      maxTotalPositionEnabled: maxTotalPositionEnabled ?? false,
      maxTotalPositionUsdt:    maxTotalPositionUsdt ?? null,
      maxSingleLossEnabled:    maxSingleLossEnabled ?? false,
      maxSingleLossUsdt:       maxSingleLossUsdt ?? null,
      minIntervalEnabled:      minIntervalEnabled ?? false,
      minIntervalMinutes:      minIntervalMinutes ?? null,
      maxSingleSizeEnabled:    maxSingleSizeEnabled ?? false,
      maxSingleSizeUsdt:       maxSingleSizeUsdt ?? null,
      forceSentence:           forceSentence ?? DEFAULT_FORCE_SENTENCE,
    },
    update: {
      ...(maxTotalPositionEnabled !== undefined && { maxTotalPositionEnabled }),
      ...(maxTotalPositionUsdt    !== undefined && { maxTotalPositionUsdt }),
      ...(maxSingleLossEnabled    !== undefined && { maxSingleLossEnabled }),
      ...(maxSingleLossUsdt       !== undefined && { maxSingleLossUsdt }),
      ...(minIntervalEnabled      !== undefined && { minIntervalEnabled }),
      ...(minIntervalMinutes      !== undefined && { minIntervalMinutes }),
      ...(maxSingleSizeEnabled    !== undefined && { maxSingleSizeEnabled }),
      ...(maxSingleSizeUsdt       !== undefined && { maxSingleSizeUsdt }),
      ...(forceSentence           !== undefined && { forceSentence }),
    },
  });

  return NextResponse.json({ setting });
}
