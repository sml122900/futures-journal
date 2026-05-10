// JSON 백업 내보내기 API
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/** GET /api/export/json — 사용자 전체 데이터 JSON 백업 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const [memos, rules, violations, reports] = await Promise.all([
      prisma.memo.findMany({ where: { userId: session.user.id }, orderBy: { updatedAt: "desc" } }),
      prisma.tradingRule.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" } }),
      prisma.ruleViolation.findMany({ where: { userId: session.user.id }, orderBy: { detectedAt: "desc" } }),
      prisma.aIReport.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" } }),
    ]);

    const backup = {
      exportedAt: new Date().toISOString(),
      version:    "1.0",
      memos,
      tradingRules: rules,
      ruleViolations: violations,
      aiReports: reports,
    };

    const dateStr = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="futures-journal-backup-${dateStr}.json"`,
      },
    });
  } catch (error) {
    console.error("[export/json]", error);
    return NextResponse.json({ success: false, message: "JSON 백업 실패" }, { status: 500 });
  }
}
