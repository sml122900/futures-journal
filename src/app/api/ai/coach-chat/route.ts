// AI 코치 채팅 API (SSE 스트리밍, 크레딧 5개/메시지, conversationId로 대화 그룹)
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const CHAT_COST = 5;
const MAX_HISTORY = 10;

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
 * Body: { message: string, conversationId?: string }
 * SSE 스트리밍 응답
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
  }

  const userId = session.user.id;
  const { message, conversationId = "default" } = await req.json();

  if (!message?.trim()) {
    return NextResponse.json({ success: false, message: "메시지를 입력해주세요" }, { status: 400 });
  }

  // 플랜 권한 체크 (premium 이상)
  const { checkFeatureAccess } = await import("@/lib/plans");
  const allowed = await checkFeatureAccess(userId, "ai_coach");
  if (!allowed) {
    return NextResponse.json(
      { success: false, message: "PLAN_REQUIRED", data: { required: "premium" } },
      { status: 403 }
    );
  }

  // 크레딧 확인
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { credits: true } });
  if (!user || user.credits < CHAT_COST) {
    return NextResponse.json(
      { success: false, message: "INSUFFICIENT_CREDITS", data: { required: CHAT_COST, current: user?.credits ?? 0 } },
      { status: 402 }
    );
  }

  // 이 대화의 히스토리
  const history = await prisma.chatMessage.findMany({
    where: { userId, conversationId },
    orderBy: { createdAt: "desc" },
    take: MAX_HISTORY,
    select: { role: true, content: true },
  });

  // 최근 심리 컨텍스트
  const recentMemos = await prisma.memo.findMany({
    where: { userId, psych: { not: "" } },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: { psych: true },
  });

  const context = recentMemos.length
    ? `[사용자 최근 심리 상태: ${recentMemos.map((m) => m.psych).join(", ")}]`
    : "";

  const messages: { role: "user" | "assistant"; content: string }[] = [
    ...history.reverse().map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
    { role: "user", content: context ? `${context}\n\n${message}` : message },
  ];

  // SSE 스트리밍
  const encoder = new TextEncoder();
  let fullReply = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const Anthropic = (await import("@anthropic-ai/sdk")).default;
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        const anthropicStream = await client.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 512,
          system: COACH_SYSTEM,
          messages,
        });

        for await (const chunk of anthropicStream) {
          if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
            const text = chunk.delta.text;
            fullReply += text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
        }

        // 스트리밍 완료 후 저장
        await prisma.$transaction([
          prisma.chatMessage.create({ data: { userId, role: "user",      content: message,    conversationId } }),
          prisma.chatMessage.create({ data: { userId, role: "assistant", content: fullReply,  conversationId } }),
          prisma.user.update({ where: { id: userId }, data: { credits: { decrement: CHAT_COST } } }),
          prisma.creditLog.create({ data: { userId, delta: -CHAT_COST, reason: "coach_chat_claude-sonnet-4-6" } }),
        ]);

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();
      } catch (error) {
        const msg = (error as Error)?.message ?? "AI 처리 실패";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

/** GET /api/ai/coach-chat?conversationId=X — 특정 대화 히스토리 조회 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get("conversationId") ?? "default";

  const history = await prisma.chatMessage.findMany({
    where: { userId: session.user.id, conversationId },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  return NextResponse.json({ success: true, data: history });
}
