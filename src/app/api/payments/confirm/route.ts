// Toss Payments 결제 승인 + 크레딧 지급
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getPackage } from "@/lib/credits";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });

  try {
    const { paymentKey, orderId, amount } = await req.json();
    if (!paymentKey || !orderId || !amount) {
      return NextResponse.json({ success: false, message: "파라미터 누락" }, { status: 400 });
    }

    // orderId 형식: {packageId}_{userId}_{timestamp}
    const packageId = orderId.split("_")[0];
    const pkg = getPackage(packageId);
    if (!pkg) return NextResponse.json({ success: false, message: "유효하지 않은 패키지" }, { status: 400 });
    if (pkg.priceKrw !== amount) {
      return NextResponse.json({ success: false, message: "금액 불일치" }, { status: 400 });
    }

    // 중복 결제 방지
    const existing = await prisma.purchase.findUnique({ where: { tossKey: paymentKey } });
    if (existing) return NextResponse.json({ success: false, message: "이미 처리된 결제" }, { status: 409 });

    // Toss API 승인
    const tossRes = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.TOSS_SECRET_KEY}:`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    if (!tossRes.ok) {
      const err = await tossRes.json();
      console.error("[payments/confirm] Toss error", err);
      return NextResponse.json({ success: false, message: err.message || "결제 승인 실패" }, { status: 400 });
    }

    // 크레딧 지급 (트랜잭션)
    await prisma.$transaction([
      prisma.purchase.create({
        data: {
          userId: session.user.id,
          packageId: pkg.id,
          credits: pkg.credits,
          amountKrw: pkg.priceKrw,
          tossKey: paymentKey,
          orderId,
          status: "completed",
        },
      }),
      prisma.user.update({
        where: { id: session.user.id },
        data: { credits: { increment: pkg.credits } },
      }),
      prisma.creditLog.create({
        data: {
          userId: session.user.id,
          delta: pkg.credits,
          reason: `purchase_${pkg.id}`,
        },
      }),
    ]);

    return NextResponse.json({ success: true, data: { credits: pkg.credits } });
  } catch (error) {
    console.error("[payments/confirm]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}
