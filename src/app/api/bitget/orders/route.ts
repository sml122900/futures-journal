// 비트겟 체결 주문 내역 조회 API (idLessThan 페이지네이션)
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { bitgetRequest, getDecryptedCredentials } from "@/lib/bitget";

export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const params: Record<string, string> = {
      productType: "USDT-FUTURES",
      limit: searchParams.get("limit") ?? "100",
    };
    const idLessThan = searchParams.get("idLessThan");
    const startTime = searchParams.get("startTime");
    const endTime = searchParams.get("endTime");
    if (idLessThan) params.idLessThan = idLessThan;
    if (startTime) params.startTime = startTime;
    if (endTime) params.endTime = endTime;

    const data = await bitgetRequest(credentials, "GET", "/api/v2/mix/order/fills", params);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[bitget/orders]", error);
    return NextResponse.json({ success: false, message: "주문 내역 조회 실패" }, { status: 500 });
  }
}
