# 트러블슈팅: 비트겟 API 90일 범위 제한

**날짜**: 2026-05-12

---

## 문제 상황

내보내기에서 "전체" 기간을 선택하면 `CSV 생성 실패` 에러 발생.

서버 로그:
```
data: {
  code: '00001',
  msg: 'startTime and endTime interval cannot be greater than 90 days',
}
```

---

## 원인

내보내기 UI에서 "전체" 선택 시 `from=undefined` → 라우트에서 `fromMs = 0` (Unix epoch, 1970년)
→ Bitget API에 `startTime=0` 전달 → 90일 초과로 거부

---

## 최종 해결법

export route에 90일 청크 분할 헬퍼 추가:

```typescript
const CHUNK = 89 * 86400000; // 89일 (여유 1일)

function makeChunks(fromMs: number, toMs: number) {
  const start = fromMs || toMs - 365 * 86400000; // from 미지정 → 최근 1년
  const chunks = [];
  let e = toMs;
  while (e > start) {
    const s = Math.max(e - CHUNK, start);
    chunks.push({ s, e });
    e = s;
  }
  return chunks;
}
```

각 청크 내에서 `idLessThan` 페이지네이션으로 100건 이상 조회.

---

## 교훈

- 비트겟 REST API: 한 요청당 최대 90일, 최대 100건
- "전체" 기간 기본값은 에포크(0)가 아니라 "최근 N일"로 안전하게 설정
- 외부 API의 페이지네이션·범위 제한은 **클라이언트가 아닌 서버에서 처리**해야 타임아웃 없음

---

## 이력서 소재

> 비트겟 API 90일 범위 제한으로 인한 내보내기 실패 — 서버사이드 청크 분할 + idLessThan 커서 페이지네이션으로 기간 무제한 조회 구현
