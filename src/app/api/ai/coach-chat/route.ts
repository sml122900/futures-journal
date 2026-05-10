// AI 코치 채팅 API (스트리밍, 크레딧 5개/메시지)
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const CHAT_COST = 5;
const MAX_HISTORY = 10; // 최근 N개 메시지 컨텍스트로 포함

const COACH_SYSTEM = `당신은 선물 거래 트레이더의 전담 AI 매매 코치입니다.
사용자의 매매 데이터를 바탕으로 친근하고 실용적인 조언을 제공하세요.

원칙:
- 구체적인 데이터가 있을 때만 수치를 언급하세요.
- 판단보다 질문으로 사고를 유도하세요.
- 200자 이내로 간결하게 답변하세요.
- 한국어로 답변하세요.
- 친근하지만 전문적인 톤을 유지하세요.`;

/**
 * POST /api/ai/coach-chat
 * Body: { message: string }
 * 이전 대화 히스토리 자동 포함, 크레딧 5개 차감
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const userId = session.user.id;
    const { message } = await req.json();
    if (!message?.trim()) {
      return NextResponse.json({ success: false, message: "메시지를 입력해주세요" }, { status: 400 });
    }

    // 크레딧 확인
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { credits: true } });
    if (!user || user.credits < CHAT_COST) {
      return NextResponse.json(
        { success: false, message: "INSUFFICIENT_CREDITS", data: { required: CHAT_COST, current: user?.credits ?? 0 } },
        { status: 402 }
      );
    }

    // 최근 대화 히스토리 조회
    const history = await prisma.chatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: MAX_HISTORY,
      select: { role: true, content: true },
    });

    // 최근 통계 컨텍스트 (메모 5개 요약)
    const recentMemos = await prisma.memo.findMany({
      where: { userId, psych: { not: "" } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { psych: true, reason: true },
    });

    const context = recentMemos.length
      ? `[사용자 최근 심리 상태: ${recentMemos.map((m) => m.psych).join(", ")}]`
      : "";

    const messages: { role: "user" | "assistant"; content: string }[] = [
      ...history.reverse().map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
      { role: "user", content: context ? `${context}\n\n${message}` : message },
    ];

    // Claude API 호출
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: COACH_SYSTEM,
      messages,
    });
    const reply = (msg.content[0] as { type: string; text: string }).text.trim();

    // 대화 저장 + 크레딧 차감 (트랜잭션)
    await prisma.$transaction([
      prisma.chatMessage.create({ data: { userId, role: "user", content: message } }),
      prisma.chatMessage.create({ data: { userId, role: "assistant", content: reply } }),
      prisma.user.update({ where: { id: userId }, data: { credits: { decrement: CHAT_COST } } }),
      prisma.creditLog.create({ data: { userId, delta: -CHAT_COST, reason: "coach_chat_claude-sonnet-4-6" } }),
    ]);

    return NextResponse.json({ success: true, data: { reply } });
  } catch (error) {
    console.error("[coach-chat]", error);
    return NextResponse.json({ success: false, message: "AI 처리 실패" }, { status: 500 });
  }
}

/** GET /api/ai/coach-chat — 대화 히스토리 조회 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const history = await prisma.chatMessage.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    return NextResponse.json({ success: true, data: history });
  } catch (error) {
    console.error("[coach-chat GET]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}
