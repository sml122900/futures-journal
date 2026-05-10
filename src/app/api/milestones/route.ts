// 마일스톤 조회 및 체크 API
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserMilestones, checkAndAwardMilestones } from "@/lib/milestone-checker";
import { getDecryptedCredentials, bitgetRequest } from "@/lib/bitget";

/** GET /api/milestones — 달성한 마일스톤 목록 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }
    const milestones = await getUserMilestones(session.user.id);
    return NextResponse.json({ success: true, data: milestones });
  } catch (error) {
    console.error("[milestones GET]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}

/** POST /api/milestones/check — 마일스톤 재체크 (데이터 동기화 후 호출) */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const credentials = await getDecryptedCredentials(session.user.id);
    if (!credentials) {
      return NextResponse.json({ success: false, message: "API 키를 먼저 등록해주세요" }, { status: 400 });
    }

    const res = await bitgetRequest(credentials, "GET", "/api/v2/mix/position/history-position", {
      productType: "USDT-FUTURES", limit: "100",
    });
    const positions = res?.data?.list ?? [];

    const newMilestones = await checkAndAwardMilestones(session.user.id, positions);
    return NextResponse.json({ success: true, data: { newMilestones } });
  } catch (error) {
    console.error("[milestones POST]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}
