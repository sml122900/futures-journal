// GET/POST /api/recurring-no-trade — 반복 매매 금지 시간대 관리 (KST 기준)
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const rules = await prisma.recurringNoTrade.findMany({
    where: { userId: session.user.id },
    orderBy: { startHour: "asc" },
  });
  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const { startHour, startMin, endHour, endMin, reason } = await req.json();
  if (
    startHour === undefined || startMin === undefined ||
    endHour   === undefined || endMin   === undefined
  ) {
    return NextResponse.json({ error: "startHour, startMin, endHour, endMin 필요" }, { status: 400 });
  }

  const valid = (h: number, m: number) =>
    Number.isInteger(h) && h >= 0 && h <= 23 &&
    Number.isInteger(m) && m >= 0 && m <= 59;

  if (!valid(startHour, startMin) || !valid(endHour, endMin)) {
    return NextResponse.json({ error: "유효하지 않은 시간 값" }, { status: 400 });
  }

  const rule = await prisma.recurringNoTrade.create({
    data: {
      userId: session.user.id,
      startHour: Number(startHour),
      startMin:  Number(startMin),
      endHour:   Number(endHour),
      endMin:    Number(endMin),
      reason:    reason ?? null,
    },
  });
  return NextResponse.json({ rule }, { status: 201 });
}
