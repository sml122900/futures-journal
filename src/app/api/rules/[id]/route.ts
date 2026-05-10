// 개별 룰 수정 / 삭제 API
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { validateRuleConfig, type RuleType } from "@/lib/rules-types";

type RouteContext = { params: Promise<{ id: string }> };

/** 룰 소유권 확인 헬퍼 */
async function ownRule(userId: string, ruleId: string) {
  return prisma.tradingRule.findFirst({ where: { id: ruleId, userId } });
}

/** PUT /api/rules/[id] — 룰 수정 (config, enabled) */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const { id } = await params;
    const rule = await ownRule(session.user.id, id);
    if (!rule) {
      return NextResponse.json({ success: false, message: "룰을 찾을 수 없습니다" }, { status: 404 });
    }

    const body = await req.json();
    const updateData: { config?: object; enabled?: boolean } = {};

    if (body.config !== undefined) {
      const error = validateRuleConfig(rule.type as RuleType, body.config);
      if (error) return NextResponse.json({ success: false, message: error }, { status: 400 });
      updateData.config = body.config;
    }

    if (body.enabled !== undefined) {
      updateData.enabled = Boolean(body.enabled);
    }

    const updated = await prisma.tradingRule.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[rules PUT]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}

/** DELETE /api/rules/[id] — 룰 삭제 (위반 기록 cascade 삭제) */
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const { id } = await params;
    const rule = await ownRule(session.user.id, id);
    if (!rule) {
      return NextResponse.json({ success: false, message: "룰을 찾을 수 없습니다" }, { status: 404 });
    }

    await prisma.tradingRule.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[rules DELETE]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}
