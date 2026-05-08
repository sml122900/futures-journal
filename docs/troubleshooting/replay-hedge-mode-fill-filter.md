# 트러블슈팅: Hedge Mode 리플레이 fills 필터링 오작동

**날짜**: 2026-05-08

---

## 문제 상황
롱 포지션 리플레이에 숏 포지션 체결(Close Short)이 혼입되어 잘못 표기됨.
동일 심볼로 롱+숏을 동시에 보유하는 hedge mode에서 포지션 구분이 불가한 상태.

---

## 시도한 것들

| 시도 | 결과 |
|------|------|
| `posSide` 필드로 필터 | API 응답에 `posSide` 필드 자체가 없음 |
| `holdSide` 필드로 필터 | API 응답에 `holdSide` 필드도 없음 |
| `positionId`로 직접 매칭 | API 응답에 `positionId` 필드 없음 |
| `tradeSide`+포지션방향 조합 (`(isBuyOrder===isOpenTrade)===(side==="long")`) | Close Short(buy+close)가 잘못 통과됨 |

---

## 원인
Bitget fills API(`/api/v2/mix/order/fills`)의 `side` 필드는 **주문 방향(buy/sell)이 아닌 포지션 방향**을 의미함.

```
side = "buy"  → 롱 포지션의 체결 (Open Long 또는 Close Long)
side = "sell" → 숏 포지션의 체결 (Open Short 또는 Close Short)
tradeSide = "open"  → 진입 체결
tradeSide = "close" → 청산 체결
```

즉, Close Long도 `side="buy"`, Close Short도 `side="sell"`.  
실제 buy/sell 방향은 `tradeSide`로만 확인 가능.

API 응답 실제 필드 목록:
`tradeId, symbol, orderId, price, baseVolume, feeDetail, side, quoteVolume, profit, enterPointSource, tradeSide, posMode, tradeScope, cTime`

---

## 최종 해결법
```typescript
const oSide = (o.side as string || "").toLowerCase();
return oSide === (side === "long" ? "buy" : "sell");
```

롱 리플레이: `o.side === "buy"` 인 fills만 포함  
숏 리플레이: `o.side === "sell"` 인 fills만 포함

---

## 이력서 소재
> Bitget Futures API 분석으로 fills 응답의 `side` 필드가 주문 방향이 아닌 포지션 방향(buy=Long, sell=Short)임을 규명, hedge mode 동시 포지션 환경에서 롱·숏 체결을 정확히 분리하는 필터 구현
