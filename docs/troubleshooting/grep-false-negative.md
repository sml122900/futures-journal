# 트러블슈팅: 검증 스크립트 grep false negative

**날짜**: 2026-05-11

---

## 문제 상황

Phase 9와 Phase 11 검증에서 실제로 구현되어 있는데도 ❌로 표시됨.

```
❌ [P9: Service Worker 캐시 전략]
❌ [P11: SSE 스트리밍]
```

---

## 원인

grep 패턴 문자열이 실제 코드와 불일치.

| 검증 항목 | 검색한 패턴 | 실제 코드 | 원인 |
|----------|-----------|---------|------|
| SW 캐시 전략 | `"Cache"` (대문자 C) | `caches.match()`, `CACHE` | 소문자 `caches`는 매치 안 됨 |
| SSE 스트리밍 | `"text-event-stream"` (하이픈) | `"text/event-stream"` (슬래시) | 구분자 차이 |

---

## 최종 해결법

패턴을 실제 코드에 맞게 수정 후 재검증:

```javascript
// 수정 전
check('public/sw.js', 'Cache', 'SW 캐시');          // ❌ false negative
check('...route.ts', 'text-event-stream', 'SSE');    // ❌ false negative

// 수정 후
check('public/sw.js', 'caches.match', 'SW 캐시');    // ✅
check('...route.ts', 'text/event-stream', 'SSE');    // ✅
```

---

## 교훈

- 자동화 검증 스크립트는 **실제 코드에서 사용하는 문자열로 패턴을 작성**해야 함
- 대소문자·구분자(하이픈 vs 슬래시) 차이로 false negative 발생 가능
- 검증 실패 시 코드 삭제 전에 **실제 파일 내용을 grep으로 직접 확인** 필수

---

## 이력서 소재

> 자동화 검증 스크립트의 grep 패턴 오류로 인한 false negative 진단 — 대소문자·구분자 불일치 원인 규명 및 수정
