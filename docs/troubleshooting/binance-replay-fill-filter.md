# 트러블슈팅: 리플레이 Binance 사용자 fill 필터 필드명 불일치

**날짜**: 2026-05-14

---

## 문제 상황

Binance API 키만 등록한 사용자가 리플레이 페이지 진입 시:
- `/api/bitget/candles`: "API 키 필요" 400 에러
- fill 방향 필터 `o.side === "buy"|"sell"` 가 Binance 응답 필드와 매칭 안 됨

---

## 원인

**1. Bitget 전용 API 직접 호출**

```typescript
// replay/page.tsx — 기존 코드
await fetch(`/api/bitget/orders?...`);
await fetch(`/api/bitget/candles?...`);
```

`/api/bitget/*`는 내부에서 `getDecryptedCredentials(userId)` 로 Bitget 전용 API 키 요구. Binance 사용자는 Bitget 키가 없어 400 반환.

**2. 필드명 차이**

| 필드 | Bitget | Binance (BinanceExchange.getOrders 반환) |
|------|--------|-------|
| 포지션 방향 | `o.side = "buy" / "sell"` | `o.posSide = "long" / "short"` |
| 타임스탬프 | `o.cTime` / `o.ctime` | `o.cTime` |

기존 필터: `o.side === (side === "long" ? "buy" : "sell")` → Binance 응답의 `o.posSide` 를 읽지 못함

---

## 최종 해결법

```typescript
// replay/page.tsx

// 1. 거래소 결정 (localStorage)
const [exchange] = useState<string>(() =>
  typeof window !== "undefined" ? (localStorage.getItem("fj_exchange") ?? "bitget") : "bitget"
);

// 2. 통합 API 호출
await fetch(`/api/exchange/orders?...&exchange=${exch}`);
await fetch(`/api/exchange/candles?...&exchange=${exch}`);

// 3. 양쪽 거래소 지원 필터
const oSide    = (o.side    as string || "").toLowerCase();  // Bitget: "buy"/"sell"
const oPosSide = (o.posSide as string || "").toLowerCase();  // Binance: "long"/"short"
return oSide === (side === "long" ? "buy" : "sell") || oPosSide === side;
```

`/api/exchange/orders` 는 `{ data: { data: { fillList: [...] } } }` 형식으로 두 거래소 모두 Bitget 호환 응답 반환. 기존 파서 수정 최소화.

---

## 교훈

- 거래소 추상화 레이어(`/api/exchange/*`) 구축 후에도 기존 `/api/bitget/*` 직접 호출 코드가 남아있으면 새 거래소에서 실패
- fill 방향 필터 작성 시 "Bitget 방식 + Binance 방식" 둘 다 방어적으로 처리

---

## 이력서 소재

> 멀티 거래소 지원 추상화 후 리플레이 페이지가 Bitget 전용 API 직접 호출 → 통합 라우트로 마이그레이션 + 거래소별 필드명 차이(side vs posSide) 처리로 Binance 호환 달성
