// GET /api/emergency-check/baseline
// Chrome 확장이 로컬 사전 체크에 사용할 UserTriggerSettings 반환
import { NextRequest, NextResponse } from "next/server";
import { authenticateExtension } from "@/lib/extension-auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = await authenticateExtension(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const setting = await prisma.userTriggerSettings.findUnique({
    where: { userId: user.id },
  });

  return NextResponse.json({
    maxTotalPositionEnabled: setting?.maxTotalPositionEnabled ?? false,
    maxTotalPositionUsdt:    setting?.maxTotalPositionUsdt ?? null,
    maxSingleLossEnabled:    setting?.maxSingleLossEnabled ?? false,
    maxSingleLossUsdt:       setting?.maxSingleLossUsdt ?? null,
    minIntervalEnabled:      setting?.minIntervalEnabled ?? false,
    minIntervalMinutes:      setting?.minIntervalMinutes ?? null,
    maxSingleSizeEnabled:    setting?.maxSingleSizeEnabled ?? false,
    maxSingleSizeUsdt:       setting?.maxSingleSizeUsdt ?? null,
    forceSentence:           setting?.forceSentence ?? "나는 충동이 아닌 원칙으로 매매할 것을 맹세한다",
    enabled: true,
  });
}
