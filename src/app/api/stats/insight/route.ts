// AI 매매 인사이트 생성 API (7일 캐시, 크레딧 15개 차감)
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getDecryptedCredentials, bitgetRequest } from "@/lib/bitget";
import { PositionRecord, buildInsightContext } from "@/lib/stats";

const INSIGHT_COST = 15;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일

const SYSTEM_PROMPT = `당신은 선물 거래 트레이더의 매매 일지를 분석하는 전문가입니다.
사용자의 최근 거래 내역과 메모를 보고, 가장 중요한 매매 패턴 인사이트를 1~2개 한국어로 자연스럽게 작성하세요.
- 구체적인 수치(승률, 손익, 횟수)를 반드시 포함하세요.
- 어떤 상황에서 손실이 집중되는지 또는 수익이 나는지 명확히 짚으세요.
- 개선 제안을 1줄 이내로 덧붙여도 됩니다.
- 마크다운 사용 금지. 순수 텍스트만 반환하세요.`;

/**
 * GET /api/stats/insight
 * GET /api/stats/insight?force=true  (캐시 무시하고 재생성, 크레딧 15개 차감)
 * 최근 7일 매매 기반 AI 인사이트 (캐시 7일, 크레딧 15개 차감)
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const userId = session.user.id;
    const force = new URL(req.url).searchParams.get("force") === "true";

    // 7일 이내 캐시 확인 (force=true면 캐시 건너뜀)
    if (!force) {
      const cached = await prisma.aIReport.findFirst({
        where: {
          userId,
          type: "weekly_insight",
          createdAt: { gte: new Date(Date.now() - CACHE_TTL_MS) },
        },
        orderBy: { createdAt: "desc" },
      });

      if (cached) {
        const content = cached.content as { insight: string };
        return NextResponse.json({
          success: true,
          data: { insight: content.insight, generatedAt: cached.createdAt, cached: true },
        });
      }
    }

    // 크레딧 확인
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true },
    });
    if (!user || user.credits < INSIGHT_COST) {
      return NextResponse.json(
        {
          success: false,
          message: "INSUFFICIENT_CREDITS",
          data: { required: INSIGHT_COST, current: user?.credits ?? 0 },
        },
        { status: 402 }
      );
    }

    // 비트겟 최근 7일 포지션 조회
    const credentials = await getDecryptedCredentials(userId);
    if (!credentials) {
      return NextResponse.json(
        { success: false, message: "API 키를 먼저 등록해주세요" },
        { status: 400 }
      );
    }

    const now = Date.now();
    const res = await bitgetRequest(credentials, "GET", "/api/v2/mix/position/history-position", {
      productType: "USDT-FUTURES",
      limit: "100",
      startTime: String(now - 7 * 24 * 60 * 60 * 1000),
      endTime: String(now),
    });

    const positions: PositionRecord[] = res?.data?.list ?? [];
    if (!positions.length) {
      return NextResponse.json(
        { success: false, message: "최근 7일 거래 내역이 없습니다" },
        { status: 400 }
      );
    }

    // 메모 조회
    const memos = await prisma.memo.findMany({
      where: { userId },
      select: {
        positionId: true,
        reason: true,
        exitReason: true,
        psych: true,
        external: true,
        text: true,
      },
    });

    const context = buildInsightContext(positions, memos);
    const userPrompt = `다음은 내 최근 7일 선물 거래 내역입니다:\n\n${context}\n\n이 데이터에서 가장 중요한 매매 패턴 인사이트를 알려주세요.`;

    // Claude 호출
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    const insight = (msg.content[0] as { type: string; text: string }).text.trim();

    const periodStart = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const periodEnd = new Date(now);

    // 크레딧 차감 + AIReport 저장 (트랜잭션)
    const [report] = await prisma.$transaction([
      prisma.aIReport.create({
        data: {
          userId,
          type: "weekly_insight",
          periodStart,
          periodEnd,
          content: { insight },
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { credits: { decrement: INSIGHT_COST } },
      }),
      prisma.creditLog.create({
        data: { userId, delta: -INSIGHT_COST, reason: "weekly_insight_claude-sonnet-4-6" },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: { insight, generatedAt: report.createdAt, cached: false },
    });
  } catch (error) {
    console.error("[stats/insight GET]", error);
    const msg = (error as Error)?.message ?? "";
    if (msg.includes("429") || msg.includes("quota")) {
      return NextResponse.json(
        { success: false, message: "AI API 할당량 초과입니다. 잠시 후 다시 시도해주세요." },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { success: false, message: "인사이트 생성 실패" },
      { status: 500 }
    );
  }
}
