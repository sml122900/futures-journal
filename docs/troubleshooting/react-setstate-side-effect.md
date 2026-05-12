# 트러블슈팅: React setState updater 내부 fetch side effect

**날짜**: 2026-05-12

---

## 문제 상황

백테스트 SL/TP 자동 청산 구현 시, 매 캔들마다 SL/TP 조건을 체크하고 조건 충족 시 서버에 청산 요청을 보내는 로직을 작성함.

첫 번째 구현:
```typescript
setTrades(prev => {
  const openT = prev.find(t => t.status === "open");
  if (triggerPrice !== null) {
    fetch(`/api/backtest/trades/${openT.id}/close`, {...}); // ← 문제
    return prev.map(...); // optimistic update
  }
  return prev;
});
```

검증 단계에서 React strict mode(dev)에서 setState updater가 2번 실행되어 `/close` API가 2번 호출될 수 있다는 문제 발견.

---

## 원인

React 18 Strict Mode는 개발 환경에서 side effect 감지를 위해 **state updater 함수를 2번 호출**함. 순수해야 할 updater에 fetch 같은 side effect가 있으면 2번 실행됨.

추가 문제: `checkAutoClose`를 `setRevealed(prev => {...})` 내부에서 호출하고 있어, 이중 실행 시 `setTrades` 호출도 연쇄적으로 2번 발생.

---

## 시도한 것들

1. `if (strict mode)` 조건부 — Strict Mode 감지 방법 없음, 해결 불가
2. `useRef` flag — 임시방편, 구조적 해결 아님

---

## 최종 해결법

setState updater를 **순수 상태 계산만** 하도록 분리, fetch를 updater 외부에서 실행.

```typescript
// 1. tradesRef: setState 외부에서 현재 trades 읽기
const tradesRef  = useRef<BTTrade[]>(trades);
useEffect(() => { tradesRef.current = trades; }, [trades]);

// 2. closingRef: 중복 청산 방지
const closingRef = useRef(new Set<string>());

const checkAutoClose = useCallback((candleIdx: number) => {
  const openT = tradesRef.current.find(t => t.status === "open"); // setState 외부에서 읽기
  if (closingRef.current.has(openT.id)) return;  // 이미 처리 중

  if (triggerPrice !== null) {
    closingRef.current.add(openT.id); // 중복 방지 마크

    // setState는 순수 상태 업데이트만
    setTrades(prev => prev.map(t => ...optimistic update...));

    // fetch는 setState 완전히 바깥
    fetch(`/api/backtest/trades/${openT.id}/close`, {...});
  }
}, [candles]);
```

---

## 교훈

- React setState updater는 **순수 함수**여야 함 — side effect 금지
- 최신 상태를 setState 외부에서 읽어야 하면 `useRef`로 동기화
- 중복 실행 방지는 `Set<id>` ref 패턴이 가장 단순

---

## 이력서 소재

> React 18 Strict Mode에서 setState updater 내부 fetch가 2번 발화되는 문제 — tradesRef + closingRef Set 패턴으로 순수 updater와 side effect 완전 분리
