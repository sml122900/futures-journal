// 포지션 시각 ±3시간 내 일기 조회
// ?ts=<timestamp_ms> 파라미터로 포지션 시각 전달
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { linkDiariesToPosition } from "@/lib/diary-linker";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const ts = parseInt(req.nextUrl.searchParams.get("ts") ?? "0");
    if (!ts) {
      return NextResponse.json({ success: false, message: "ts 파라미터가 필요합니다" }, { status: 400 });
    }

    const diaries = await linkDiariesToPosition(session.user.id, ts);
    return NextResponse.json({ success: true, data: diaries });
  } catch (error) {
    console.error("[positions/related-diaries]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}
