// 심리 일기 통계 API
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const THREE_HOURS = 3 * 60 * 60 * 1000;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const [diaries, allMemos] = await Promise.all([
      prisma.tradingDiary.findMany({
        where: { userId: session.user.id },
        select: { mood: true, tags: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.memo.findMany({
        where: { userId: session.user.id },
        select: { updatedAt: true },
      }),
    ]);

    // mood 분포
    const moodCount: Record<string, number> = {};
    for (const d of diaries) {
      if (d.mood) moodCount[d.mood] = (moodCount[d.mood] ?? 0) + 1;
    }

    // 태그 빈도
    const tagCount: Record<string, number> = {};
    for (const d of diaries) {
      for (const t of d.tags) {
        tagCount[t] = (tagCount[t] ?? 0) + 1;
      }
    }

    // 주별 작성 빈도 (최근 12주)
    const now = Date.now();
    const weeklyFreq: { week: string; count: number }[] = [];
    for (let w = 11; w >= 0; w--) {
      const weekStart = new Date(now - (w + 1) * 7 * 86400000);
      const weekEnd   = new Date(now - w * 7 * 86400000);
      const count = diaries.filter(d => d.createdAt >= weekStart && d.createdAt < weekEnd).length;
      weeklyFreq.push({ week: weekStart.toISOString().slice(0, 10), count });
    }

    // 365일 캘린더 히트맵
    const calendarMap: Record<string, number> = {};
    for (const d of diaries) {
      const key = d.createdAt.toISOString().slice(0, 10);
      calendarMap[key] = (calendarMap[key] ?? 0) + 1;
    }

    // mood × 다음 거래(메모) 상관관계
    // 일기 이후 ±3시간 내 작성된 메모 횟수로 근사
    const moodActivity: Record<string, { diaryCount: number; nearTradeCount: number }> = {};
    for (const d of diaries) {
      if (!d.mood) continue;
      if (!moodActivity[d.mood]) moodActivity[d.mood] = { diaryCount: 0, nearTradeCount: 0 };
      moodActivity[d.mood].diaryCount++;
      const hasNearTrade = allMemos.some(
        (m) => Math.abs(m.updatedAt.getTime() - d.createdAt.getTime()) < THREE_HOURS
      );
      if (hasNearTrade) moodActivity[d.mood].nearTradeCount++;
    }

    return NextResponse.json({
      success: true,
      data: {
        total: diaries.length,
        moodCount,
        topTags: Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 20),
        weeklyFreq,
        calendarMap,
        moodActivity,
      },
    });
  } catch (error) {
    console.error("[diaries/stats]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}
