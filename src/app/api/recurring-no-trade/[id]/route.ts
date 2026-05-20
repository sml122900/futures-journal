// PATCH/DELETE /api/recurring-no-trade/[id]
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const { id } = await params;
  const rule = await prisma.recurringNoTrade.findUnique({ where: { id } });
  if (!rule || rule.userId !== session.user.id) {
    return NextResponse.json({ error: "찾을 수 없음" }, { status: 404 });
  }

  const body = await req.json();
  const updated = await prisma.recurringNoTrade.update({
    where: { id },
    data: {
      ...(body.startHour !== undefined && { startHour: Number(body.startHour) }),
      ...(body.startMin  !== undefined && { startMin:  Number(body.startMin) }),
      ...(body.endHour   !== undefined && { endHour:   Number(body.endHour) }),
      ...(body.endMin    !== undefined && { endMin:    Number(body.endMin) }),
      ...(body.reason    !== undefined && { reason:    body.reason }),
      ...(body.enabled   !== undefined && { enabled:   Boolean(body.enabled) }),
    },
  });
  return NextResponse.json({ rule: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const { id } = await params;
  const rule = await prisma.recurringNoTrade.findUnique({ where: { id } });
  if (!rule || rule.userId !== session.user.id) {
    return NextResponse.json({ error: "찾을 수 없음" }, { status: 404 });
  }

  await prisma.recurringNoTrade.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
