// 특정 리포트 상세 조회 API
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/reports/[id] — 특정 리포트 상세 조회 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const { id } = await params;
    const report = await prisma.aIReport.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!report) {
      return NextResponse.json({ success: false, message: "리포트를 찾을 수 없습니다" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error("[reports/[id] GET]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}
