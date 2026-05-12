# 기술 결정: 거래소 추상화 레이어 설계

**날짜**: 2026-05-12

---

## 배경

기존 코드가 Bitget API에 직접 결합되어 있어 (`src/lib/bitget.ts`, `/api/bitget/*`), 다른 거래소를 추가하려면 모든 API 라우트와 클라이언트 코드를 복제해야 했음.

---

## 결정: 거래소별 클래스 + Bitget 호환 raw 포맷 응답 유지

### 구조

```
src/lib/exchanges/
├── types.ts         ← ExchangeId, ApiCredentials, Candle 등 공통 타입
├── BaseExchange.ts  ← abstract class (5개 메서드 강제)
├── BitgetExchange.ts
├── BinanceExchange.ts
├── factory.ts       ← createExchange() / createExchangeForUser()
└── index.ts
```

### 핵심 결정: 응답 형식을 Bitget 호환으로 유지

DashboardContent.tsx의 파서(`parseOrders`, `parsePosHist`)가 이미 Bitget 필드명에 최적화되어 있었음.

**포기한 대안**: 추상화 레이어에서 `UnifiedOrder`, `UnifiedClosedPosition` 같은 새 타입으로 정규화 후 클라이언트 파서도 교체.

**이유**: DashboardContent는 1,000줄+ 대형 컴포넌트. 파서 교체는 회귀 리스크 과다. 대신 각 Exchange 클래스가 Bitget 호환 필드명으로 응답을 정규화하는 전략 선택.

```typescript
// BinanceExchange.getOrders()가 Bitget 호환 필드명 반환
return {
  tradeId: String(t.id),
  posSide: holdSide,      // "long" | "short"
  tradeSide: "open"|"close",
  totalProfits: t.realizedPnl,
  cTime: String(t.time),
  // ...
};
```

### 파일명 충돌 해결

`src/lib/exchanges.ts`와 `src/lib/exchanges/` 디렉토리 공존 불가 (Node.js 모듈 해석이 파일 우선). → `exchanges.ts` → `exchange-meta.ts`로 이름 변경.

---

## 포기한 대안

- **단일 파일 분기**: `if (exchange === "bitget") { ... } else { ... }` — 거래소 추가마다 모든 파일 수정 필요
- **UnifiedXxx 타입 + 클라이언트 파서 교체**: 정합성은 좋으나 DashboardContent 전면 재작성 위험
