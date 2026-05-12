// 거래 ↔ 일기 자동 연동 헬퍼
// 거래 타임스탬프와 일기 타임스탬프를 ±3시간 기준으로 매칭

import prisma from "./prisma";

const THREE_HOURS = 3 * 60 * 60 * 1000;

/** 특정 포지션 시각 ±3시간 내 작성된 일기 목록 반환 */
export async function linkDiariesToPosition(userId: string, positionTimestampMs: number) {
  const from = new Date(positionTimestampMs - THREE_HOURS);
  const to   = new Date(positionTimestampMs + THREE_HOURS);

  return prisma.tradingDiary.findMany({
    where: {
      userId,
      createdAt: { gte: from, lte: to },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, content: true, mood: true, tags: true, createdAt: true },
  });
}

/** 특정 일기 타임스탬프 ±3시간 내 작성된 메모 목록 반환 (메모는 포지션을 대리) */
export async function linkPositionsToDiary(userId: string, diaryTimestamp: Date) {
  const from = new Date(diaryTimestamp.getTime() - THREE_HOURS);
  const to   = new Date(diaryTimestamp.getTime() + THREE_HOURS);

  return prisma.memo.findMany({
    where: {
      userId,
      updatedAt: { gte: from, lte: to },
    },
    orderBy: { updatedAt: "asc" },
    select: { positionId: true, reason: true, exitReason: true, psych: true, updatedAt: true },
  });
}
