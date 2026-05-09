// 음성 원문 → Claude/Gemini 필드 분류 (서비스 API 키 사용, 크레딧 차감)
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { CREDIT_COSTS } from "@/lib/credits";

const SYSTEM_PROMPT = `당신은 선물 거래 매매 일지 작성을 돕는 AI입니다.
사용자가 음성으로 말한 내용을 아래 5개 필드로 분류하세요.
반드시 JSON만 반환하세요. 다른 텍스트, 마크다운 코드블록 절대 포함 금지.

필드:
- reason: 진입 이유 (시그널, 패턴, 기술적 근거)
- exitReason: 청산 이유 (목표가 도달, 손절 기준, 판단)
- psych: 심리 상태 (감정, 확신도, 조급함 등)
- external: 외부 변수 (뉴스, 매크로, 시장 상황)
- text: 기타 반성/개선점/자유 메모

해당 없는 필드는 빈 문자열. 분류 불가 내용은 text에 넣을 것.`;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });

  try {
    const { transcript, model, positionContext } = await req.json();
    if (!transcript?.trim() || !model) {
      return NextResponse.json({ success: false, message: "transcript와 model 필요" }, { status: 400 });
    }

    const cost = CREDIT_COSTS[model];
    if (cost === undefined) return NextResponse.json({ success: false, message: "지원하지 않는 모델" }, { status: 400 });

    // 크레딧 확인 및 차감 (트랜잭션)
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { credits: true } });
    if (!user || user.credits < cost) {
      return NextResponse.json({ success: false, message: "INSUFFICIENT_CREDITS", data: { required: cost, current: user?.credits ?? 0 } }, { status: 402 });
    }

    const userPrompt = `포지션 정보: ${positionContext || "없음"}\n\n사용자 발화:\n"${transcript}"`;
    let parsed: Record<string, string>;

    if (model.startsWith("claude")) {
      parsed = await callClaude(model, userPrompt);
    } else {
      parsed = await callGemini(model, userPrompt);
    }

    // 성공 시 크레딧 차감
    await prisma.$transaction([
      prisma.user.update({ where: { id: session.user.id }, data: { credits: { decrement: cost } } }),
      prisma.creditLog.create({ data: { userId: session.user.id, delta: -cost, reason: `voice_memo_${model}` } }),
    ]);

    return NextResponse.json({ success: true, data: parsed });
  } catch (error) {
    console.error("[structure-memo]", error);
    const msg = (error as Error)?.message ?? "";
    if (msg.includes("429") || msg.includes("quota") || msg.includes("Quota")) {
      return NextResponse.json({ success: false, message: "AI API 할당량 초과입니다. 다른 모델을 선택하거나 잠시 후 다시 시도해주세요." }, { status: 429 });
    }
    if (msg.includes("401") || msg.includes("API key") || msg.includes("authentication")) {
      return NextResponse.json({ success: false, message: "AI API 키가 유효하지 않습니다. 관리자에게 문의해주세요." }, { status: 500 });
    }
    return NextResponse.json({ success: false, message: "AI 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}

async function callClaude(model: string, prompt: string): Promise<Record<string, string>> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });
  return JSON.parse((msg.content[0] as { type: string; text: string }).text.trim());
}

async function callGemini(model: string, prompt: string): Promise<Record<string, string>> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY!);
  const genModel = genAI.getGenerativeModel({ model, systemInstruction: SYSTEM_PROMPT });
  const result = await genModel.generateContent(prompt);
  const raw = result.response.text().trim();
  return JSON.parse(raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim());
}
