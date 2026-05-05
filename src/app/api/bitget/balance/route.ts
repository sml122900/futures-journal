// 비트겟 잔고 조회 API
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { bitgetRequest, getDecryptedCredentials } from "@/lib/bitget";

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

    const data = await bitgetRequest(credentials, "GET", "/api/v2/mix/account/accounts", {
      productType: "USDT-FUTURES",
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[bitget/balance]", error);
    return NextResponse.json({ success: false, message: "잔고 조회 실패" }, { status: 500 });
  }
}
