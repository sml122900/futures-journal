// 비트겟 현재 오픈 포지션 조회 API + 룰 위반 감지
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { bitgetRequest, getDecryptedCredentials } from "@/lib/bitget";
import { checkAllPositions } from "@/lib/rule-engine";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const credentials = await getDecryptedCredentials(session.user.id);
    if (!credentials) {
      return NextResponse.json(
        { success: false, message: "API 키를 먼저 등록해주세요" },
        { status: 400 }
      );
    }

    const data = await bitgetRequest(
      credentials,
      "GET",
      "/api/v2/mix/position/all-position",
      { productType: "USDT-FUTURES" }
    );

    // 오픈 포지션 대상 룰 위반 감지 (응답 차단 없이 백그라운드 실행)
    const positions = data?.data ?? [];
    if (positions.length > 0) {
      checkAllPositions(session.user.id, credentials, positions).catch(
        (e) => console.error("[rule-engine] checkAllPositions 실패:", e)
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[bitget/positions]", error);
    return NextResponse.json({ success: false, message: "포지션 조회 실패" }, { status: 500 });
  }
}
