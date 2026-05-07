# 트러블슈팅: Bitget fills API 필드명 불일치

**날짜**: 2026-05-07

---

## 문제 상황
주문 내역 테이블에서 체결가, 포지션손익, 수수료, 순손익 컬럼이 모두 빈값(`-`) 또는 `0`으로 표시됨. 심볼, 방향, 날짜는 정상 표시.

---

## 시도한 것들
- 브라우저 콘솔에서 API 응답 구조 확인 시도
- 서버 로그에 임시 `console.log` 추가

---

## 원인
`/api/v2/mix/order/fills` 엔드포인트(fills)와 주문 이력 엔드포인트(orders-history)의 필드명이 다름.

| 필드 | orders-history | fills (우리가 쓰는 것) |
|------|----------------|----------------------|
| 체결가 | `priceAvg` | `price` |
| 포지션손익 | `totalProfits` | `profit` |
| 수수료 | `fee` (직접) | `feeDetail.USDT.totalFee` (객체) |
| 고유 ID | `orderId` (unique) | `tradeId` (unique), `orderId` (중복) |

`orderId`를 row key로 쓰면 하나의 주문에 여러 fill이 있을 경우 중복 key 오류 발생.

## 최종 해결법
파싱 함수에 필드명 fallback 처리:
```typescript
const avg = parseFloat(o.price || o.priceAvg || '0');
const posProfit = parseFloat(o.totalProfits || o.profit || '0');

let fee = parseFloat(o.fee || '0');
if (fee === 0 && o.feeDetail) {
  for (const v of Object.values(o.feeDetail)) {
    const f = parseFloat(v?.totalFee || '0');
    if (f !== 0) { fee = f; break; }
  }
}

const id = o.tradeId || o.orderId || `row-${i}`;
```

## 이력서 소재
> 외부 API 응답 구조 불일치를 필드명 fallback 체인으로 해결, 엔드포인트별 스키마 차이를 분석하여 양쪽 호환 파싱 함수 구현
