// POST /api/extension/token — 새 토큰 발급 (세션 인증)
// GET  /api/extension/token — 내 토큰 목록
// DELETE /api/extension/token?id=xxx — 토큰 폐기

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateToken } from "@/lib/extension-auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tokens = await prisma.extensionToken.findMany({
    where: { userId: session.user.id, revokedAt: null },
    select: { id: true, name: true, lastUsedAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ tokens });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await req.json().catch(() => ({}));

  // 사용자당 토큰 최대 5개
  const count = await prisma.extensionToken.count({
    where: { userId: session.user.id, revokedAt: null },
  });
  if (count >= 5) {
    return NextResponse.json({ error: "토큰은 최대 5개까지 발급 가능합니다" }, { status: 400 });
  }

  const token = generateToken();
  const record = await prisma.extensionToken.create({
    data: {
      userId: session.user.id,
      token,
      name: name || null,
    },
  });

  return NextResponse.json({ token, id: record.id, createdAt: record.createdAt });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });

  const record = await prisma.extensionToken.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.extensionToken.update({
    where: { id },
    data: { revokedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
