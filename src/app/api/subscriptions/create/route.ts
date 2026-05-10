// 구독 결제 시작 API (Toss 정기결제 빌링키 발급 흐름)
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { PLAN_INFO, type Plan } from "@/lib/plans";

/**
 * POST /api/subscriptions/create
 * Body: { plan: "pro" | "premium" | "team" }
 * Toss 정기결제 빌링키 발급을 위한 successUrl/failUrl 반환
 *
 * 실제 빌링키 발급은 Toss 대시보드에서 "자동결제" 상품 활성화 후 구현 가능.
 * 현재는 URL 생성까지만 구현 (라이브 연동 시 완성 예정).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const { plan } = await req.json() as { plan: Plan };

    if (!plan || !["pro", "premium", "team"].includes(plan)) {
      return NextResponse.json({ success: false, message: "유효하지 않은 플랜입니다" }, { status: 400 });
    }

    const planInfo = PLAN_INFO[plan];
    const customerKey = `${session.user.id}_${Date.now()}`;
    const origin = req.headers.get("origin") ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";

    // Toss 자동결제 빌링키 발급 URL
    // 실제 연동: POST https://api.tosspayments.com/v1/billing/authorizations/issue
    // 현재: 프론트엔드에서 loadTossPayments().requestBillingAuth() 호출에 필요한 파라미터 반환
    return NextResponse.json({
      success: true,
      data: {
        plan,
        planLabel:    planInfo.label,
        priceKrw:     planInfo.priceKrw,
        customerKey,
        successUrl:   `${origin}/subscriptions/success?plan=${plan}`,
        failUrl:      `${origin}/pricing?error=billing_failed`,
        clientKey:    process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY,
        note:         "Toss 정기결제 빌링키 발급은 라이브 환경에서 완성 예정입니다.",
      },
    });
  } catch (error) {
    console.error("[subscriptions/create POST]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}
