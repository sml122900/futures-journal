# Futures Journal — Phase S 작업 계획

> Phase 13 (Vercel 배포) 완료 후 진행할 S등급 우선 기능 3가지.
> Claude Code 자동 진행용 계획서.

---

## 자동 진행 규칙

1. 아래 진행 상태 표에서 `⏳ 대기` 항목부터 순서대로 진행
2. 각 Phase 시작 시 `[진행중]` 표시
3. 완료 시 `✅ 완료` 표시
4. 각 Phase 끝나면 `npm run build` 실행해서 빌드 확인
5. 빌드 성공 시 자동으로 다음 Phase 진행
6. 빌드 실패 시 멈추고 에러 보고
7. 각 Phase 완료 시 변경 파일 목록을 1~2줄로 요약

## 멈추고 사용자에게 물어봐야 하는 경우

- 사용자 시각적 결정이 필요한 모호한 디자인 선택
- 외부 서비스 가입이 필요한 경우 (Binance/Bybit API 키 발급은 사용자 본인 계정 필요)
- 기존 코드와 충돌이 심해 큰 리팩토링이 필요한 경우

---

## 진행 상태

| Phase | 작업 | 상태 |
|-------|------|------|
| S1 | 거래소 추가 — Binance | ✅ 완료 |
| S2 | 심리 일기 (Trading Diary) | ✅ 완료 |
| S3 | 백테스트 모드 | ✅ 완료 |

---

# Phase S1 — 거래소 추가 (Binance)

## 목표

현재 Bitget만 지원하는 구조를 다중 거래소 지원으로 확장. 첫 추가 거래소는 Binance.

기존 코드가 Bitget에 강하게 결합되어 있을 가능성이 높으므로, 먼저 거래소 추상화 레이어를 만들고 그 위에 Binance를 얹는 순서로 작업.

## S1-1. 거래소 추상화 레이어 구축

### 폴더 구조

`src/lib/exchanges/` 디렉토리 생성, 아래 파일 작성:

```
src/lib/exchanges/
├── types.ts                  # 공통 타입 정의
├── BaseExchange.ts           # 추상 클래스
├── BitgetExchange.ts         # 기존 Bitget 로직 이전
├── BinanceExchange.ts        # 새로 추가
├── factory.ts                # 거래소 인스턴스 생성
└── index.ts                  # public exports
```

### types.ts

거래소 공통 인터페이스 정의.

```typescript
export type ExchangeId = "bitget" | "binance";

export interface ApiCredentials {
  apiKey: string;
  secretKey: string;
  passphrase?: string;  // bitget 만 사용
}

export interface UnifiedBalance {
  accountEquity: number;
  available: number;
  unrealizedPL: number;
  marginRate: number;
}

export interface UnifiedPosition {
  positionId: string;
  symbol: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  markPrice: number;
  liquidationPrice: number;
  margin: number;
  unrealizedPnl: number;
  leverage: number;
  openedAt: number;
}

export interface UnifiedOrder {
  orderId: string;
  symbol: string;
  side: "long" | "short";
  type: "open" | "close";
  size: number;
  price: number;
  fee: number;
  realizedPnl: number;
  filledAt: number;
}

export interface UnifiedClosedPosition {
  positionId: string;
  symbol: string;
  side: "long" | "short";
  openPrice: number;
  closePrice: number;
  size: number;
  netProfit: number;
  totalFunding: number;
  totalFee: number;
  openedAt: number;
  closedAt: number;
}

export interface FetchRangeOptions {
  startTime: number;
  endTime: number;
}
```

### BaseExchange.ts

추상 클래스로 모든 거래소가 구현해야 할 메서드 정의.

```typescript
export abstract class BaseExchange {
  protected credentials: ApiCredentials;
  abstract exchangeId: ExchangeId;

  constructor(credentials: ApiCredentials) {
    this.credentials = credentials;
  }

  abstract getBalance(): Promise<UnifiedBalance>;
  abstract getPositions(): Promise<UnifiedPosition[]>;
  abstract getOrders(opts: FetchRangeOptions): Promise<UnifiedOrder[]>;
  abstract getClosedPositions(opts: FetchRangeOptions): Promise<UnifiedClosedPosition[]>;
  abstract getCandles(symbol: string, interval: string, opts: FetchRangeOptions): Promise<Candle[]>;
}
```

### BitgetExchange.ts

기존 `src/lib/bitget.ts`의 로직을 이전. 인터페이스에 맞게 응답 매핑.

기존 코드는 그대로 두지 말고 새 클래스로 마이그레이션 후 기존 파일 deprecated 처리.

### factory.ts

거래소 인스턴스 생성 팩토리.

```typescript
export function createExchange(
  exchangeId: ExchangeId,
  credentials: ApiCredentials
): BaseExchange {
  switch (exchangeId) {
    case "bitget": return new BitgetExchange(credentials);
    case "binance": return new BinanceExchange(credentials);
    default: throw new Error(`Unsupported exchange: ${exchangeId}`);
  }
}
```

## S1-2. DB 스키마 확장

기존 `ApiKey` 모델에 `exchange` 필드가 이미 있다면 그대로 사용. 없으면 추가.

```prisma
model ApiKey {
  // ... 기존 필드
  exchange  String   @default("bitget")  // "bitget" | "binance"
  @@unique([userId, exchange])  // 사용자당 거래소별 하나
}
```

User 한 명이 여러 거래소 키를 등록할 수 있도록 변경.

## S1-3. Binance API 연동

### Binance Futures API 기본 정보

- Base URL: `https://fapi.binance.com`
- 서명: HMAC-SHA256 (query string의 `timestamp` 기반)
- 헤더: `X-MBX-APIKEY`
- USDT-M 선물 전용

### 주요 엔드포인트

| 기능 | 엔드포인트 |
|------|----------|
| 잔고 | GET /fapi/v2/account |
| 현재 포지션 | GET /fapi/v2/positionRisk |
| 주문 내역 | GET /fapi/v1/userTrades |
| 종료 포지션 | GET /fapi/v1/income (incomeType=REALIZED_PNL) |
| 캔들 | GET /fapi/v1/klines |

### BinanceExchange.ts 구현

```typescript
export class BinanceExchange extends BaseExchange {
  exchangeId = "binance" as const;
  private baseUrl = "https://fapi.binance.com";

  private sign(queryString: string): string {
    return crypto
      .createHmac("sha256", this.credentials.secretKey)
      .update(queryString)
      .digest("hex");
  }

  private async signedRequest(path: string, params: Record<string, any> = {}) {
    params.timestamp = Date.now();
    const queryString = new URLSearchParams(params).toString();
    const signature = this.sign(queryString);
    const url = `${this.baseUrl}${path}?${queryString}&signature=${signature}`;

    const res = await fetch(url, {
      headers: { "X-MBX-APIKEY": this.credentials.apiKey }
    });
    return res.json();
  }

  async getBalance(): Promise<UnifiedBalance> {
    const data = await this.signedRequest("/fapi/v2/account");
    return {
      accountEquity: parseFloat(data.totalWalletBalance),
      available: parseFloat(data.availableBalance),
      unrealizedPL: parseFloat(data.totalUnrealizedProfit),
      marginRate: parseFloat(data.totalMaintMargin) / parseFloat(data.totalWalletBalance)
    };
  }

  // ... 나머지 메서드 구현
}
```

각 메서드에서 Binance 응답을 Unified 타입으로 매핑.

## S1-4. API 라우트 통합

기존 `src/app/api/bitget/*` 라우트들을 `src/app/api/exchange/*` 로 이동/통합.

```
src/app/api/exchange/
├── balance/route.ts
├── positions/route.ts
├── orders/route.ts
├── position-history/route.ts
└── candles/route.ts
```

각 라우트에서:
1. 세션에서 userId 추출
2. DB에서 활성 거래소의 ApiKey 조회 (사용자가 선택한 거래소)
3. createExchange() 로 인스턴스 생성
4. 해당 메서드 호출
5. 결과 반환

기존 `/api/bitget/*` 는 호환성을 위해 한동안 유지하되 deprecated 표시.

## S1-5. 온보딩 UI 개선

`src/app/onboarding/exchange/page.tsx` 수정:

- 거래소 선택 화면 추가 (Bitget / Binance 카드)
- 각 카드 클릭 시 해당 거래소 API 키 입력 페이지로 이동
- 이미 등록된 거래소는 "연결됨" 표시

`src/app/onboarding/exchange/[slug]/page.tsx` 수정:

- slug에 따라 다른 가이드 표시 (bitget / binance)
- Binance API 키 발급 가이드 작성 (https://www.binance.com/en/my/settings/api-management)
- 권한 설정: "Read Only" 만 체크하도록 안내

`src/app/onboarding/exchange/[slug]/guide/page.tsx`:
- 각 거래소별 API 키 발급 스크린샷 가이드

## S1-6. 거래소 전환 UI

대시보드 상단에 거래소 선택 드롭다운 추가.

`src/app/dashboard/_components/ExchangeSelector.tsx`:
- 사용자가 등록한 거래소 목록 표시
- 선택 시 모든 데이터 해당 거래소 기준으로 새로고침
- 선택 상태는 localStorage 저장

또는 통합 뷰 옵션: "모든 거래소" 선택 시 데이터 합쳐서 표시.

## S1-7. 통계 페이지 거래소 필터

기존 통계 페이지에 거래소 필터 추가:
- 전체 / Bitget / Binance
- 거래소별 비교 차트 (수익률, 거래량)

## S1-8. 설정 페이지

`src/app/settings/api-keys/page.tsx`:
- 등록된 모든 거래소 API 키 목록
- 거래소별 추가/수정/삭제 버튼
- 키 재발급 가이드 링크

## 주의사항

- 기존 Bitget 사용자 데이터가 깨지지 않도록 마이그레이션 신중하게
- Binance API rate limit 주의 (1분당 2400 요청)
- IP 화이트리스트 안내 (Vercel 배포 후 동적 IP 문제 가능)
- HEDGE 모드와 ONE-WAY 모드 차이 처리 (Binance는 두 모드 다 지원)

---

# Phase S2 — 심리 일기 (Trading Diary)

## 목표

거래와 별개로 매매 심리 상태를 자유롭게 기록하는 일기 시스템. 거래 데이터와 자동 연동되어 AI 코치가 더 깊이 있는 조언을 제공할 수 있게 함.

기존의 거래별 메모(MemoModal)와는 다른 개념:
- **거래별 메모**: 특정 포지션에 대한 메모 (진입이유/심리/외부변수)
- **심리 일기**: 시점 기반 자유 기록 (오늘 시장 분위기, 컨디션, 계획, 회고 등)

## S2-1. DB 스키마 추가

```prisma
model TradingDiary {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  content   String   // 일기 본문
  mood      String?  // "calm" | "anxious" | "confident" | "fearful" | "greedy" | "frustrated" | "tired"
  tags      String[] @default([])  // 자유 태그 ["연속익절", "큰손실후", "뉴스반응"] 등
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId, createdAt])
}
```

User 모델에 관계 추가:
```prisma
diaries TradingDiary[]
```

## S2-2. API 라우트

### `src/app/api/diaries/route.ts`

- **GET**: 내 일기 목록 (최신순)
  - 쿼리: `?from=&to=&mood=` 필터 지원
  - 페이지네이션 (커서 기반)
- **POST**: 새 일기 작성
  - Body: `{ content, mood?, tags? }`

### `src/app/api/diaries/[id]/route.ts`

- **PUT**: 일기 수정
- **DELETE**: 일기 삭제

### `src/app/api/diaries/stats/route.ts`

- **GET**: 일기 통계
  - 가장 자주 등장한 mood
  - 일기 작성 빈도 (주별/월별)
  - mood × 다음 날 매매 결과 상관관계

## S2-3. UI 구성

### 일기 메인 페이지

`src/app/diary/page.tsx` (서버 컴포넌트) + `DiaryContent.tsx`

레이아웃:
```
┌──────────────────────────────────────┐
│  💭 매매 일기                          │
│  [+ 새 일기 작성]      [통계 보기]    │
├──────────────────────────────────────┤
│  필터: [전체] [평정] [불안] [공포]... │
├──────────────────────────────────────┤
│  ┌─ 오늘                              │
│  │  10:30 평정                        │
│  │  "BTC 60K 돌파 대기 중..."         │
│  │  태그: 횡보 분석                   │
│  └─                                  │
│                                      │
│  ┌─ 어제                              │
│  │  23:15 피곤                        │
│  │  "지친 상태. 매매 자제하자"        │
│  └─                                  │
└──────────────────────────────────────┘
```

### 빠른 입력 위젯

`src/app/dashboard/_components/DiaryQuickInput.tsx`

대시보드 상단에 항상 표시되는 한 줄 입력창.
- "오늘 시장은 어떻게 보세요?" placeholder
- 클릭 시 확장되어 mood 선택 + 텍스트 입력
- 저장 시 토스트 알림

### 일기 작성 모달

`src/app/diary/_components/DiaryFormModal.tsx`

- mood 선택 (이모지 + 라벨): 평정 😌, 불안 😰, 자신감 😎, 공포 😨, 탐욕 🤑, 좌절 😤, 피곤 😴
- 본문 입력 (textarea, 자유 길이)
- 태그 입력 (자동완성, 기존 태그 재사용 가능)
- 저장 / 취소

### 일기 타임라인

`src/app/diary/_components/DiaryTimeline.tsx`

- 날짜별 그룹화 (오늘 / 어제 / 이번 주 / 더 보기)
- 각 일기 카드: 시각, mood 이모지, 본문 미리보기, 태그
- 호버 시 수정/삭제 버튼 노출
- 클릭 시 상세 모달

### 일기 통계

`src/app/diary/stats/page.tsx`

- mood 분포 도넛 차트
- mood × 다음 거래 결과 매트릭스 ("불안 상태에서 다음 날 매매 승률 34%")
- 일기 작성 캘린더 (heatmap)
- 가장 많이 쓰는 태그 워드클라우드

## S2-4. AI 코치 통합

심리 일기를 AI 분석에 포함시킴.

`src/lib/ai-prompts.ts` 의 주간 리포트 프롬프트 수정:
- 입력 데이터에 해당 주의 일기 모음 추가
- AI 프롬프트에 일기 데이터 활용 지시:
  ```
  사용자의 심리 일기를 보면 화요일에 "큰 손실 후 멘탈 흔들림"이라고 기록했고,
  그 다음 거래에서 평소의 1.8배 사이즈로 진입했다.
  이런 패턴을 짚어주고 다음 번 비슷한 상황 대처법을 조언해줘.
  ```

`src/app/api/ai/coach-chat/route.ts` 수정:
- 채팅 컨텍스트에 최근 7일 일기 데이터 자동 주입

## S2-5. 거래 ↔ 일기 자동 연동

거래 발생 시 시간적으로 가까운 일기 자동 연결:

`src/lib/diary-linker.ts`:
- 새 거래 발생 시 ±3시간 내 일기 자동 매칭
- 거래 상세 페이지에 "이 시점의 일기" 표시
- 일기 상세에 "이날의 거래" 표시

## S2-6. 네비게이션

대시보드 헤더에 "일기" 메뉴 추가. 경로 `/diary`.

대시보드의 빠른 입력 위젯에서 "더 보기" 클릭 시 일기 페이지로 이동.

## 주의사항

- 일기는 매매 도구가 아니라 자기 반성 도구. UI 톤은 따뜻하고 부담 없게
- 작성 강요 X (배지나 알림 없음)
- 빈 상태 UX 중요: "오늘 어떤 매매를 했는지 한 줄 남겨보세요"
- 일기 내용은 매우 개인적이므로 절대 외부 노출 금지 (공개 옵션도 없음)

---

# Phase S3 — 백테스트 모드

## 목표

기존 리플레이 인프라를 재활용하여 과거 시점에서 가상 거래를 실험할 수 있는 모드 추가.

사용자가 실제 손실 없이 매매 의사결정을 학습하고, 본인 매매 전략을 검증할 수 있게 함.

## S3-1. DB 스키마 추가

```prisma
model BacktestSession {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name        String                              // "ETH 4월 1주차 백테스트"
  symbol      String                              // 트레이딩 페어
  startTime   BigInt                              // 백테스트 시작 시점 (ms)
  endTime     BigInt                              // 백테스트 종료 시점 (ms)
  initialSeed Float    @default(1000)             // 초기 가상 시드 (USDT)
  status      String   @default("active")         // "active" | "completed"
  createdAt   DateTime @default(now())
  completedAt DateTime?

  trades      BacktestTrade[]

  @@index([userId, createdAt])
}

model BacktestTrade {
  id            String           @id @default(cuid())
  sessionId     String
  session       BacktestSession  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  side          String                              // "long" | "short"
  entryPrice    Float
  exitPrice     Float?
  size          Float                               // 가상 수량
  leverage      Float            @default(1)
  entryTime     BigInt                              // 가상 진입 시점 (캔들 기준 ms)
  exitTime      BigInt?                             // 가상 청산 시점
  pnl           Float?                              // 실현 손익 (가상)
  status        String           @default("open")   // "open" | "closed"

  @@index([sessionId, entryTime])
}
```

## S3-2. API 라우트

### `src/app/api/backtest/sessions/route.ts`

- **GET**: 내 백테스트 세션 목록
- **POST**: 새 백테스트 세션 시작
  - Body: `{ name, symbol, startTime, endTime, initialSeed? }`

### `src/app/api/backtest/sessions/[id]/route.ts`

- **GET**: 세션 상세 (세션 정보 + 모든 가상 거래)
- **DELETE**: 세션 삭제

### `src/app/api/backtest/sessions/[id]/complete/route.ts`

- **POST**: 세션 완료 처리

### `src/app/api/backtest/trades/route.ts`

- **POST**: 가상 진입
  - Body: `{ sessionId, side, entryPrice, size, leverage, entryTime }`

### `src/app/api/backtest/trades/[id]/close/route.ts`

- **POST**: 가상 청산
  - Body: `{ exitPrice, exitTime }`
  - 서버에서 pnl 계산 후 저장

## S3-3. 핵심 UI — 백테스트 플레이어

기존 `src/app/replay/page.tsx` 와 유사한 구조로 작성.

`src/app/backtest/page.tsx` — 백테스트 메인 (세션 목록 + 새 세션 시작)

`src/app/backtest/[id]/page.tsx` — 백테스트 플레이어

### 플레이어 레이아웃

```
┌────────────────────────────────────────────────┐
│ ETH/USDT — 백테스트  (시드: $1,000 → $1,247)    │
│ ▶ ⏸ 1× 2× 4× 8×    [세션 종료]                 │
├──────────────────────────────────────┬─────────┤
│                                      │  포지션 │
│         캔들 차트                     │  내역   │
│         (Lightweight Charts)         │         │
│                                      │  💰진입 │
│         현재 시각: 2026-04-15 14:30  │  💰진입 │
│         가격: 3,450                  │  💰진입 │
│                                      │         │
│  [🟢 LONG 진입]  [🔴 SHORT 진입]      │  통계   │
│                                      │  승률   │
│  현재 포지션: 없음                    │  ROI    │
│                                      │  사이즈 │
└──────────────────────────────────────┴─────────┘
```

### 핵심 기능

1. **캔들 재생** (기존 리플레이 인프라 그대로 활용)
   - 시작 시점부터 캔들 1개씩 시간순 노출
   - 배속 1×/2×/4×/8×
   - 일시정지/재생

2. **가상 진입**
   - "LONG 진입" / "SHORT 진입" 버튼
   - 진입 시 수량/레버리지 모달
   - 진입 즉시 차트에 마커 표시

3. **가상 청산**
   - 포지션 카드의 "청산" 버튼
   - 현재 캔들 종가 기준 자동 청산
   - 청산 즉시 손익 계산 + 표시

4. **자동 청산** (선택)
   - 진입 시 손절가/익절가 설정 가능
   - 가격 도달 시 자동 청산

5. **사이드바**
   - 현재 가상 시드
   - 현재 ROI
   - 진행 중인 포지션
   - 종료된 포지션 목록 (이번 세션)
   - 통계: 승률, 평균 ROI, 최대 손실

## S3-4. 세션 결과 페이지

세션 완료 시 결과 페이지 자동 표시:

`src/app/backtest/[id]/result/page.tsx`

- 총 수익률
- 총 거래 횟수
- 승률
- 평균 진입/청산 거리
- 최대 손실 / 최대 수익 거래
- 시드 변화 그래프
- "실제 거래와 비교" 섹션 — 같은 시기 실거래가 있다면 옆에 나란히 비교

## S3-5. 본인 매매 패턴 기반 시나리오

심화 기능 — 사용자 본인의 약점 시나리오 자동 생성.

`src/app/api/backtest/scenarios/route.ts`:

- **GET**: 추천 시나리오 목록
  - 본인 매매 데이터 분석
  - 손실이 컸던 시점 추출
  - "당신은 이때 -8% 손실을 봤습니다. 다시 매매해보세요" 형태

`src/app/backtest/scenarios/page.tsx`:
- 추천 시나리오 카드 그리드
- 각 카드: 시점, 심볼, 그때 본인이 한 거래 요약
- "다시 시도하기" 버튼 → 백테스트 세션 자동 생성

## S3-6. 신규 사용자 진입 장벽 완화

신규 사용자 온보딩에 "백테스트 체험" 단계 추가:

- API 키 등록 전이라도 백테스트는 가능하도록
- 미리 정의된 샘플 시나리오 5개 제공 (다양한 시장 상황)
- "10분 만에 매매 연습해보기" CTA

`src/app/onboarding/backtest/page.tsx`:
- 샘플 시나리오 선택
- 짧은 튜토리얼 (진입/청산 방법)
- 완료 시 결과 + "이제 실제 거래 일지로 시작하기" 안내

## S3-7. 네비게이션

대시보드 헤더에 "백테스트" 메뉴 추가. 경로 `/backtest`.

홈/대시보드 빈 상태에서 "백테스트로 연습해보기" CTA 노출.

## S3-8. 통합 통계

백테스트 결과를 실거래 통계와 분리하되, "백테스트 vs 실거래" 비교 페이지 제공:

`src/app/backtest/comparison/page.tsx`:
- 백테스트 승률 vs 실거래 승률
- 백테스트 ROI vs 실거래 ROI
- 둘 다 잘되면 "전략이 일관됩니다", 백테스트만 잘되면 "심리 문제일 수 있습니다" 같은 인사이트

## 주의사항

- 캔들 데이터는 기존 `/api/exchange/candles` 재활용 (Phase S1 후에는 거래소 추상화 사용)
- 백테스트는 미래 데이터를 미리 보면 안 됨 (lookhead bias 방지)
- 가상 거래 마커는 실거래 마커와 시각적으로 구분 (점선 vs 실선 등)
- 슬리피지/수수료는 단순화 (수수료 0.04% 고정, 슬리피지 0)
- 백테스트는 도박이 아닌 학습 도구임을 UI에서 명시

---

# 전체 작업 순서 권장

```
S1 (거래소 추상화 + Binance)
  → 빌드 확인
  → S2 (심리 일기)
  → 빌드 확인
  → S3 (백테스트)
  → 빌드 확인
  → 최종 완료 보고
```

각 Phase 사이에 충돌이 발생하면 멈추고 사용자에게 보고.

---

# 진행 시 주의 사항

1. **기존 Bitget 사용자 데이터 보존** — S1에서 마이그레이션 시 기존 데이터 깨지면 안 됨
2. **점진적 마이그레이션** — `/api/bitget/*` 는 한동안 유지, 새 라우트로 점진적 이전
3. **PWA 캐시 무효화** — 라우트 변경 시 SW 캐시 갱신 필요
4. **AI 프롬프트 토큰 관리** — 심리 일기까지 포함하면 컨텍스트 길어짐. 토큰 제한 고려
5. **백테스트 데이터 격리** — 실거래 통계에 백테스트 결과 섞이지 않도록 철저히 분리

---

**이 PHASE_S.md를 읽고 자동 진행해줘.**
