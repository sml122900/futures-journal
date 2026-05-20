// DELETE /api/no-trade-windows/[id]
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const { id } = await params;
  const win = await prisma.noTradeWindow.findUnique({ where: { id } });
  if (!win || win.userId !== session.user.id) {
    return NextResponse.json({ error: "찾을 수 없음" }, { status: 404 });
  }

  await prisma.noTradeWindow.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
