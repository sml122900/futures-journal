import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/** GET /api/users/me — Android 앱 토큰 검증 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }
    const token = authHeader.slice(7);

    const user = await prisma.user.findUnique({
      where: { androidAuthToken: token },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, message: "유효하지 않은 토큰" }, { status: 401 });
    }

    return NextResponse.json({ id: user.id, email: user.email, name: user.name });
  } catch (error) {
    console.error("[users/me GET]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}
