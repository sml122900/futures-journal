// 현재 구독 플랜 조회 API
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/** GET /api/subscriptions/current — 현재 플랜 조회 (없으면 free) */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const sub = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
    });

    return NextResponse.json({
      success: true,
      data: {
        plan:      sub?.plan      ?? "free",
        status:    sub?.status    ?? "active",
        expiresAt: sub?.expiresAt ?? null,
      },
    });
  } catch (error) {
    console.error("[subscriptions/current GET]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}
