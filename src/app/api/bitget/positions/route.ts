// 비트겟 현재 오픈 포지션 조회 API + 룰 위반 감지 + 마일스톤 체크
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { bitgetRequest, getDecryptedCredentials } from "@/lib/bitget";
import { checkAllPositions } from "@/lib/rule-engine";
import { checkAndAwardMilestones } from "@/lib/milestone-checker";

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

    // 룰 위반 감지 + 마일스톤 체크 (백그라운드, 응답 차단 없음)
    const positions = data?.data ?? [];
    if (positions.length > 0) {
      checkAllPositions(session.user.id, credentials, positions).catch(
        (e) => console.error("[rule-engine] checkAllPositions 실패:", e)
      );
    }

    // 포지션 히스토리로 마일스톤 체크 (30일치 비동기 조회)
    Promise.resolve().then(async () => {
      try {
        const histRes = await bitgetRequest(credentials, "GET", "/api/v2/mix/position/history-position", {
          productType: "USDT-FUTURES", limit: "100",
        });
        const histList = histRes?.data?.list ?? [];
        if (histList.length) {
          await checkAndAwardMilestones(session.user.id, histList);
        }
      } catch (e) {
        console.error("[milestone-checker] 자동 체크 실패:", e);
      }
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[bitget/positions]", error);
    return NextResponse.json({ success: false, message: "포지션 조회 실패" }, { status: 500 });
  }
}
