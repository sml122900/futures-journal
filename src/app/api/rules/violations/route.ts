// 룰 위반 기록 조회 API
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * GET /api/rules/violations
 * Query: ?from=ISO&to=ISO&ruleType=time_block
 * 정렬: detectedAt DESC
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const from       = searchParams.get("from");
    const to         = searchParams.get("to");
    const ruleType   = searchParams.get("ruleType");
    const positionId = searchParams.get("positionId");

    const violations = await prisma.ruleViolation.findMany({
      where: {
        userId: session.user.id,
        ...(ruleType   ? { ruleType }   : {}),
        ...(positionId ? { positionId } : {}),
        ...(from || to ? {
          detectedAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to   ? { lte: new Date(to)   } : {}),
          },
        } : {}),
      },
      orderBy: { detectedAt: "desc" },
      include: { rule: { select: { type: true, enabled: true } } },
    });

    return NextResponse.json({ success: true, data: violations });
  } catch (error) {
    console.error("[rules/violations GET]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}
