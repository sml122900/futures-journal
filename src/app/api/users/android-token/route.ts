import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { randomBytes } from "crypto";

/** GET /api/users/android-token — Android 앱 토큰 조회 또는 발급 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { androidAuthToken: true },
    });

    if (user?.androidAuthToken) {
      return NextResponse.json({ success: true, token: user.androidAuthToken });
    }

    const newToken = randomBytes(32).toString("hex");
    await prisma.user.update({
      where: { id: session.user.id },
      data: { androidAuthToken: newToken },
    });

    return NextResponse.json({ success: true, token: newToken });
  } catch (error) {
    console.error("[users/android-token GET]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}

/** POST /api/users/android-token — 토큰 재발급 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const newToken = randomBytes(32).toString("hex");
    await prisma.user.update({
      where: { id: session.user.id },
      data: { androidAuthToken: newToken },
    });

    return NextResponse.json({ success: true, token: newToken });
  } catch (error) {
    console.error("[users/android-token POST]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}
