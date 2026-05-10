// AI 코치 대화 목록 API (conversationId 그룹별 최신 메시지)
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * GET /api/ai/coach-conversations
 * 사용자의 대화 목록 (conversationId 기준, 최신 메시지 포함)
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    // 각 conversationId의 최신 메시지 조회
    const latest = await prisma.chatMessage.findMany({
      where: { userId: session.user.id },
      distinct: ["conversationId"],
      orderBy: { createdAt: "desc" },
      select: { conversationId: true, content: true, createdAt: true, role: true },
      take: 20,
    });

    return NextResponse.json({ success: true, data: latest });
  } catch (error) {
    console.error("[coach-conversations GET]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}

/**
 * POST /api/ai/coach-conversations — 새 conversationId 생성
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
  }
  const id = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  return NextResponse.json({ success: true, data: { conversationId: id } });
}
