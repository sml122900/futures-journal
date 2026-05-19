import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/** POST /api/emergency/proceed — Android 앱에서 타이핑 통과 후 진행 */
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
    const { sessionId, typedText, durationSeconds = 0 } = body;

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
        userAction: `proceed_typing:${durationSeconds}s`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[emergency/proceed POST]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}
