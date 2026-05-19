// 임시 FCM 테스트 엔드포인트 — 실기기 E2E 확인용
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendEmergencyPush } from "@/lib/fcm-sender";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
  }

  const sent = await sendEmergencyPush(session.user.id, {
    sessionId: "test-session-123",
    level: 3,
    symbol: "ETHUSDT",
    side: "long",
    size: 6.0,
    sizeMultiplier: 4.0,
    triggers: ["size_multiplier_high"],
    forceSentence: "원칙을 지켜야 살아남는다",
    countdown: 10,
  });

  return NextResponse.json({ success: sent, message: sent ? "발송 완료" : "등록된 디바이스 없음 또는 발송 실패" });
}
