# 트러블슈팅: 리플레이 영상 조기 종료

**날짜**: 2026-05-08

---

## 문제 상황
주문 내역이 더 남아있는데 영상이 일찍 끝나버리는 현상. 마지막 체결 이전에 재생이 멈춤.

---

## 원인 (3가지 복합)

1. **`actualTo` 계산 오류**: 마지막 CLOSE/PARTIAL_CLOSE fill을 기준으로 캔들 범위 종료 시각을 계산 → ADD 타입 등이 마지막이면 캔들 범위가 짧아짐
2. **fills 시간 범위 부족**: `endTime=${to}` 로 잘라서 조회 → 타임스탬프 오차로 일부 fill 누락
3. **캔들 pad 부족**: `Math.max(duration × 0.15, 30분)` 이 짧은 포지션에서 부족

---

## 최종 해결법
```typescript
// fills: from-5분 ~ to+5분 (±24h에서 축소)
const fillStart = from - 5 * 60_000;
const fillEnd   = to   + 5 * 60_000;

// actualTo: 마지막 fill 시각 (타입 무관)
const lastFill  = parsedFills[parsedFills.length - 1];
const actualTo  = lastFill?.time || to;

// 캔들 범위: 진입 1시간 전 ~ 마지막 체결 1시간 후 고정
const prepad  = 60 * 60_000;
const postpad = 60 * 60_000;
```

---

## 이력서 소재
> 리플레이 조기 종료 원인을 3가지 복합 요인(actualTo 계산, 시간 범위, 캔들 pad)으로 분리 진단, 마지막 fill 타임스탬프 기반 캔들 범위 재설계로 해결
