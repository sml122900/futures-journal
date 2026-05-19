import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/** GET /api/devices — 내 디바이스 목록 (웹 앱) */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const devices = await prisma.deviceRegistration.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, platform: true, deviceName: true, lastSeenAt: true, createdAt: true },
    });

    return NextResponse.json({ success: true, data: devices });
  } catch (error) {
    console.error("[devices GET]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}
