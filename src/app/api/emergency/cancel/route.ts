import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/** POST /api/emergency/cancel — Android 앱에서 경고 취소 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }
    const token = authHeader.slice(7);

    const user = await prisma.user.findUnique({ where: { androidAuthToken: token } });
    if (!user) {
      return NextResponse.json({ success: false, message: "유효하지 않은 토큰" }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId, reason = "user_cancelled" } = body;

    if (!sessionId) {
      return NextResponse.json({ success: false, message: "sessionId 필요" }, { status: 400 });
    }

    const session = await prisma.emergencyAlertSession.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== user.id) {
      return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });
    }

    await prisma.emergencyAlertSession.update({
      where: { id: sessionId },
      data: {
        userAction: reason,
        cancelledAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[emergency/cancel POST]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}
