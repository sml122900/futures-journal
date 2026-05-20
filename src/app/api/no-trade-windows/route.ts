// GET/POST /api/no-trade-windows — 단발성 매매 금지 시간 관리
// 입력: KST ISO 문자열 → DB: UTC 저장
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const windows = await prisma.noTradeWindow.findMany({
    where: { userId: session.user.id, endAt: { gt: new Date() } },
    orderBy: { startAt: "asc" },
  });
  return NextResponse.json({ windows });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const { startAt, endAt, reason } = await req.json();
  if (!startAt || !endAt) {
    return NextResponse.json({ error: "startAt, endAt 필요" }, { status: 400 });
  }

  // 클라이언트는 KST ISO 문자열 전송, DB에는 UTC로 저장
  const startUtc = new Date(startAt);
  const endUtc   = new Date(endAt);
  if (isNaN(startUtc.getTime()) || isNaN(endUtc.getTime())) {
    return NextResponse.json({ error: "유효하지 않은 날짜" }, { status: 400 });
  }
  if (endUtc <= startUtc) {
    return NextResponse.json({ error: "종료 시각은 시작 시각 이후여야 합니다" }, { status: 400 });
  }

  const win = await prisma.noTradeWindow.create({
    data: {
      userId:  session.user.id,
      startAt: startUtc,
      endAt:   endUtc,
      reason:  reason ?? null,
    },
  });
  return NextResponse.json({ window: win }, { status: 201 });
}
