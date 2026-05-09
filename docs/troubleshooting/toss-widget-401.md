# 트러블슈팅: Toss 결제위젯 401 오류

**날짜**: 2026-05-10

---

## 문제 상황

`@tosspayments/payment-widget-sdk`의 `loadPaymentWidget` + `renderPaymentMethods` 호출 시 401 에러 발생.

```
GET https://api.tosspayments.com/v1/payment-widget/widget-groups/keys?variantKey=DEFAULT 401 (Unauthorized)
Error: 알 수 없는 에러가 발생했습니다.
```

---

## 시도한 것들

| 시도 | 결과 |
|------|------|
| React Strict Mode 이중 실행 방지 (`initializedRef`) | 에러 동일 |
| `readyPaymentMethod` 이벤트로 렌더링 완료 후 결제 시도 | 에러 동일 |
| 테스트 키 재확인 | 키 형식 정상 |

---

## 원인

`@tosspayments/payment-widget-sdk` (결제위젯)는 Toss Payments 대시보드에서 **"결제위젯" 상품을 별도로 활성화**해야 사용 가능한 별도 제품임. 일반 결제 테스트 키(`test_ck_...`)로는 인증 불가.

---

## 최종 해결법

`@tosspayments/payment-widget-sdk` → `@tosspayments/payment-sdk`로 교체.  
일반 결제창 방식은 표준 테스트 키로 즉시 사용 가능.

```typescript
import { loadTossPayments } from "@tosspayments/payment-sdk";

const tossPayments = await loadTossPayments(clientKey);
await tossPayments.requestPayment("카드", {
  amount, orderId, orderName, successUrl, failUrl,
});
```

위젯 DOM 렌더링 불필요 → 페이지 구조 단순화.

---

## 이력서 소재

> Toss Payments 결제위젯(SDK) 401 오류를 제품 구조 분석으로 진단 (위젯=별도 상품 활성화 필요), 일반 결제창 SDK로 전환해 즉시 결제 연동 완료
