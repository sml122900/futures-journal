// 리스크 룰 목록 조회 / 생성 API
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { validateRuleConfig, type RuleType } from "@/lib/rules-types";

/** GET /api/rules — 내 룰 목록 (enabled 먼저, createdAt 내림차순) */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const rules = await prisma.tradingRule.findMany({
      where: { userId: session.user.id },
      orderBy: [{ enabled: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ success: true, data: rules });
  } catch (error) {
    console.error("[rules GET]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}

/** POST /api/rules — 새 룰 생성 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const { type, config, enabled = true } = await req.json();

    if (!type || !config) {
      return NextResponse.json({ success: false, message: "type과 config는 필수입니다" }, { status: 400 });
    }

    const validationError = validateRuleConfig(type as RuleType, config);
    if (validationError) {
      return NextResponse.json({ success: false, message: validationError }, { status: 400 });
    }

    const rule = await prisma.tradingRule.create({
      data: {
        userId: session.user.id,
        type,
        config,
        enabled: Boolean(enabled),
      },
    });

    return NextResponse.json({ success: true, data: rule }, { status: 201 });
  } catch (error) {
    console.error("[rules POST]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}
