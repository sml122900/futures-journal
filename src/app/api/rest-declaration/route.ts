// 오늘 휴식 선언 CRUD API
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const VALID_HOURS = [1, 3, 6, 12, 24];

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const active = await prisma.restDeclaration.findFirst({
    where: { userId: session.user.id, expiresAt: { gt: new Date() }, cancelledAt: null },
    orderBy: { declaredAt: "desc" },
  });

  return NextResponse.json({ active });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { hours, reason } = await req.json();
  if (!VALID_HOURS.includes(hours)) {
    return NextResponse.json({ error: "유효하지 않은 시간" }, { status: 400 });
  }

  const declaration = await prisma.restDeclaration.create({
    data: {
      userId:    session.user.id,
      expiresAt: new Date(Date.now() + hours * 3600_000),
      reason:    reason ?? null,
    },
  });

  return NextResponse.json({ declaration });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const active = await prisma.restDeclaration.findFirst({
    where: { userId: session.user.id, expiresAt: { gt: new Date() }, cancelledAt: null },
  });

  if (active) {
    await prisma.restDeclaration.update({
      where: { id: active.id },
      data:  { cancelledAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true });
}
