// KST(Asia/Seoul, UTC+9) 변환 헬퍼 — 모든 시간은 KST 기준으로 처리
const KST_OFFSET_MS = 9 * 3600_000;

export function toKST(date: Date): Date {
  return new Date(date.getTime() + KST_OFFSET_MS);
}

export function toUTC(kstDate: Date): Date {
  return new Date(kstDate.getTime() - KST_OFFSET_MS);
}

export function nowKST(): Date {
  return toKST(new Date());
}

export function getKSTHourMin(date: Date): { hour: number; min: number } {
  const kst = toKST(date);
  return { hour: kst.getUTCHours(), min: kst.getUTCMinutes() };
}

/** KST 기준 시간대 범위 체크. 자정 넘어가는 케이스 (예: 23:00~06:00) 처리. */
export function isInTimeRange(
  now: Date,
  startHour: number,
  startMin: number,
  endHour: number,
  endMin: number
): boolean {
  const { hour, min } = getKSTHourMin(now);
  const nowMins   = hour * 60 + min;
  const startMins = startHour * 60 + startMin;
  const endMins   = endHour * 60 + endMin;

  if (startMins <= endMins) {
    return nowMins >= startMins && nowMins < endMins;
  }
  // 자정 넘어가는 범위 (예: 23:00~06:00)
  return nowMins >= startMins || nowMins < endMins;
}
