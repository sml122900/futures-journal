// 거래 통계 계산 API (포지션 내역 + 메모 기반)
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getDecryptedCredentials, bitgetRequest } from "@/lib/bitget";
import { computeStats, PositionRecord } from "@/lib/stats";

const PERIOD_MS: Record<string, number> = {
  "7d":  7  * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
};

/**
 * GET /api/stats?period=7d|30d|90d|all
 * GET /api/stats?startTime=X&endTime=Y  (커스텀 기간, 이전 기간 비교용)
 * 포지션 내역을 비트겟에서 가져와 메모와 결합한 통계를 반환
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") ?? "30d";
    const customStart = searchParams.get("startTime");
    const customEnd = searchParams.get("endTime");

    const credentials = await getDecryptedCredentials(session.user.id);
    if (!credentials) {
      return NextResponse.json(
        { success: false, message: "API 키를 먼저 등록해주세요" },
        { status: 400 }
      );
    }

    // 기간 파라미터 설정 (커스텀 우선, 그 다음 period 키워드)
    const now = Date.now();
    const baseParams: Record<string, string> = {
      productType: "USDT-FUTURES",
      limit: "100",
    };
    if (customStart && customEnd) {
      baseParams.startTime = customStart;
      baseParams.endTime = customEnd;
    } else if (period !== "all" && PERIOD_MS[period]) {
      baseParams.startTime = String(now - PERIOD_MS[period]);
      baseParams.endTime = String(now);
    }

    // idLessThan 페이지네이션 (최대 500개, 5페이지)
    const allPositions: PositionRecord[] = [];
    let idLessThan: string | undefined;

    for (let page = 0; page < 5; page++) {
      const params = idLessThan
        ? { ...baseParams, idLessThan }
        : { ...baseParams };

      const res = await bitgetRequest(
        credentials,
        "GET",
        "/api/v2/mix/position/history-position",
        params
      );

      const list: PositionRecord[] = res?.data?.list ?? [];
      if (!list.length) break;
      allPositions.push(...list);
      if (list.length < 100) break;
      idLessThan = list[list.length - 1].positionId;
    }

    // 이 사용자의 메모 전체 조회
    const memos = await prisma.memo.findMany({
      where: { userId: session.user.id },
      select: {
        positionId: true,
        reason: true,
        exitReason: true,
        psych: true,
        external: true,
        text: true,
      },
    });

    const stats = computeStats(allPositions, memos);
    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    console.error("[stats GET]", error);
    return NextResponse.json(
      { success: false, message: "통계 계산 실패" },
      { status: 500 }
    );
  }
}
