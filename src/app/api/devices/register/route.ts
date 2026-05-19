import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/** POST /api/devices/register — FCM 토큰 등록 (Android 앱) */
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
    const { fcmToken, platform = "android", deviceName } = body;

    if (!fcmToken || typeof fcmToken !== "string") {
      return NextResponse.json({ success: false, message: "fcmToken 필요" }, { status: 400 });
    }

    const device = await prisma.deviceRegistration.upsert({
      where: { fcmToken },
      update: {
        userId: user.id,
        platform,
        deviceName: deviceName ?? null,
        lastSeenAt: new Date(),
      },
      create: {
        userId: user.id,
        fcmToken,
        platform,
        deviceName: deviceName ?? null,
        lastSeenAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, data: { id: device.id } });
  } catch (error) {
    console.error("[devices/register POST]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}
