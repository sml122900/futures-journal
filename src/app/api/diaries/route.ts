// 심리 일기 목록 조회 / 생성
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const cursor    = searchParams.get("cursor") ?? undefined;
    const mood      = searchParams.get("mood") ?? undefined;
    const from      = searchParams.get("from");
    const to        = searchParams.get("to");
    const limit     = 20;

    const diaries = await prisma.tradingDiary.findMany({
      where: {
        userId: session.user.id,
        ...(mood ? { mood } : {}),
        ...(from || to ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to   ? { lte: new Date(to)   } : {}),
          }
        } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = diaries.length > limit;
    const items   = hasMore ? diaries.slice(0, limit) : diaries;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return NextResponse.json({ success: true, data: { diaries: items, nextCursor } });
  } catch (error) {
    console.error("[diaries GET]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const { content, mood, tags = [] } = await req.json();
    if (!content?.trim()) {
      return NextResponse.json({ success: false, message: "내용을 입력해주세요" }, { status: 400 });
    }

    const diary = await prisma.tradingDiary.create({
      data: {
        userId: session.user.id,
        content: content.trim(),
        mood: mood ?? null,
        tags: Array.isArray(tags) ? tags : [],
      },
    });

    return NextResponse.json({ success: true, data: diary });
  } catch (error) {
    console.error("[diaries POST]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}
