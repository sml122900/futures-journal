# Phase E (Telegram) — Emergency Brake 텔레그램 도배

> 뇌동매매 감지 시 텔레그램으로 강력한 다단계 알림을 폭격하여 사용자의 의식을 환기시키는 기능. Claude Code 자동 진행용 계획서.

---

## 자동 진행 규칙

1. 아래 작업을 순서대로 진행
2. 각 단계 끝나면 `npm run build` 실행해서 빌드 확인
3. 빌드 성공 시 자동으로 다음 단계 진행
4. 빌드 실패 시 멈추고 에러 보고
5. 각 단계 완료 시 변경/생성 파일 목록을 1~2줄로만 요약

## 멈추고 사용자에게 물어봐야 하는 경우

- DB 마이그레이션 충돌
- 외부 서비스 추가 가입 필요 (이번 작업은 없을 예정)
- 디자인 결정이 모호한 경우

---

## 기능 개요

기존 텔레그램 알림은 1회 발송 후 종료. 그러나 뇌동매매를 막으려면 사용자가 한 번에 무시하지 못하도록 짧은 시간에 다회 발송 필요.

**알림 도배**는 큰 사이즈 진입 등 위험 감지 후 30초~1분 동안 텔레그램 봇이 다른 톤의 메시지 6번을 연속 발송. 5분 후 후속 알림으로 청산 여부 확인.

### 타깃 시나리오

```
23:30 - 비트겟 모바일에서 평소 4배 사이즈 진입
23:30:03 - 우리 서버 감지 → 텔레그램 첫 알림
23:30:04 - "🚨🚨🚨 평소 4배 사이즈 진입!"
23:30:07 - "🛑 지금 청산하면 손실 최소"
23:30:14 - "30일 연속 흑자 깨질 위험"
23:30:24 - "이런 패턴 과거 3번 모두 큰 손실"
23:30:39 - AI 코치 톤 메시지 (차분한 톤)
23:31:04 - 마지막 결정: 청산 / 진행 버튼
23:35:00 - 5분 후 후속: 현재 PnL + 권고

→ 사용자가 알림 폭격으로 의식 환기 → 청산 결정 또는 충동 식음
```

---

## 진행 상태

| 단계 | 작업 | 상태 |
|------|------|------|
| E1 | UserBaseline 모델 + 자동 계산 | ✅ 완료 |
| E2 | EmergencyAlertSession 모델 + 큐 시스템 | ✅ 완료 |
| E3 | 위험 감지 로직 (Level 판단) | ✅ 완료 |
| E4 | 알림 시퀀스 6종 템플릿 | ✅ 완료 |
| E5 | 알림 스케줄러 + Cron 통합 | ✅ 완료 |
| E6 | Callback 처리 (청산 버튼) | ✅ 완료 |
| E7 | "오늘 휴식" 토글 UI | ✅ 완료 |
| E8 | Emergency 설정 페이지 | ✅ 완료 |
| E9 | 통합 + 위험 감지 자동갱신 통합 | ✅ 완료 |

---

## E1. UserBaseline 모델 + 자동 계산

### 1-1. Prisma 스키마 추가

`prisma/schema.prisma`에 추가:

```prisma
model UserBaseline {
  id                    String   @id @default(cuid())
  userId                String   @unique
  user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  exchange              String                        // "bitget" | "binance"
  avgPositionSize       Float    @default(0)          // USDT 기준 평균 진입 사이즈
  medianPositionSize    Float    @default(0)          // 중간값 (이상치 제거용)
  avgRoi                Float    @default(0)          // 최근 30일 평균 ROI
  consecutiveProfitDays Int      @default(0)          // 연속 흑자 일수
  riskyHours            Json     @default("[]")       // 손실 비율 높은 시간대 [0-23]
  riskyDaysOfWeek       Json     @default("[]")       // [0-6] 손실 비율 높은 요일
  sampleSize            Int      @default(0)          // 베이스라인 계산에 사용된 거래 수
  lastCalculatedAt      DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@unique([userId, exchange])
  @@index([userId])
}
```

User 모델에 관계 추가:
```prisma
baselines UserBaseline[]
```

`npx prisma db push` 실행.

### 1-2. Baseline 계산 라이브러리

`src/lib/baseline-calculator.ts` 생성:

```typescript
/**
 * 사용자의 평소 매매 패턴을 계산하여 UserBaseline 업데이트
 * 매일 자정 cron으로 실행
 */
export async function recalculateBaseline(
  userId: string,
  exchange: string
): Promise<UserBaseline> {
  // 최근 30일 종료 포지션 조회
  const positions = await getRecentClosedPositions(userId, exchange, 30);

  if (positions.length < 5) {
    // 데이터 부족 시 baseline 미계산
    return null;
  }

  // 1. 평균/중간값 사이즈
  const sizes = positions.map(p => p.size);
  const avgSize = average(sizes);
  const medianSize = median(sizes);

  // 2. 평균 ROI
  const rois = positions.map(p => p.roi);
  const avgRoi = average(rois);

  // 3. 연속 흑자 일수
  const consecutiveProfitDays = calculateProfitStreak(positions);

  // 4. 위험 시간대 (손실 비율 60% 이상인 시간대)
  const riskyHours = findRiskyHours(positions);

  // 5. 위험 요일
  const riskyDaysOfWeek = findRiskyDays(positions);

  // upsert로 저장
  return prisma.userBaseline.upsert({
    where: { userId_exchange: { userId, exchange } },
    create: { ... },
    update: { ... }
  });
}
```

### 1-3. Baseline 갱신 Cron

`src/app/api/cron/baseline-update/route.ts`:

```typescript
// 매일 자정 KST (UTC 15:00) 실행
// vercel.json 추가:
// { "path": "/api/cron/baseline-update", "schedule": "0 15 * * *" }

export async function GET(request: Request) {
  // CRON_SECRET 검증
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 활성 사용자 전체 조회
  const users = await prisma.user.findMany({
    where: { apiKeys: { some: {} } }
  });

  let updated = 0;
  for (const user of users) {
    for (const apiKey of user.apiKeys) {
      try {
        await recalculateBaseline(user.id, apiKey.exchange);
        updated++;
      } catch (e) {
        console.error(`baseline update failed for ${user.id}`, e);
      }
    }
  }

  return NextResponse.json({ updated });
}
```

`vercel.json`에 cron 추가:
```json
{
  "crons": [
    { "path": "/api/cron/baseline-update", "schedule": "0 15 * * *" }
  ]
}
```

---

## E2. EmergencyAlertSession 모델 + 큐

### 2-1. Prisma 스키마

```prisma
model EmergencyAlertSession {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  positionId   String                              // 진입된 포지션 ID
  exchange     String
  symbol       String
  side         String                              // "long" | "short"
  size         Float
  sizeMultiplier Float                             // 평소 대비 N배
  level        Int                                 // 1, 2, 3
  triggers     Json                                // ["size_4x", "rest_violated", ...]
  context      Json                                // baseline 정보, 과거 패턴 등

  startedAt    DateTime @default(now())
  alertsSent   Int      @default(0)
  userAction   String?                             // "closed" | "kept" | "ignored"
  cancelledAt  DateTime?                           // 사용자 청산 또는 무시 시각

  scheduledAlerts EmergencyScheduledAlert[]

  @@index([userId, startedAt])
}

model EmergencyScheduledAlert {
  id          String   @id @default(cuid())
  sessionId   String
  session     EmergencyAlertSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  step        Int                                  // 1, 2, 3, 4, 5, 6, 7 (5분 후)
  scheduledAt DateTime                             // 발송 예정 시각
  sentAt      DateTime?                            // 실제 발송 시각
  status      String   @default("pending")         // "pending" | "sent" | "cancelled"

  @@index([status, scheduledAt])
}
```

`npx prisma db push` 실행.

### 2-2. RestDeclaration 모델 (휴식 선언)

```prisma
model RestDeclaration {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  declaredAt  DateTime  @default(now())
  expiresAt   DateTime                            // declaredAt + 사용자 선택 시간
  reason      String?                             // 선택 입력
  cancelledAt DateTime?                           // 사용자가 명시적으로 해제

  @@index([userId, expiresAt])
}
```

User 모델에 관계:
```prisma
emergencySessions EmergencyAlertSession[]
restDeclarations  RestDeclaration[]
```

---

## E3. 위험 감지 로직

### 3-1. Level 판단 함수

`src/lib/emergency-detector.ts`:

```typescript
export type EmergencyTrigger =
  | "size_multiplier_low"       // 1.5~2배
  | "size_multiplier_mid"        // 2~5배
  | "size_multiplier_high"       // 5배 이상
  | "rest_declared_violated"     // "오늘 쉼" 선언 위반
  | "consecutive_profit_break"   // 7일+ 연속 흑자 중 큰 사이즈
  | "risky_time_window"          // 위험 시간대
  | "risky_day_of_week";         // 위험 요일

export interface EmergencyDecision {
  level: 0 | 1 | 2 | 3;
  triggers: EmergencyTrigger[];
  context: {
    avgSize: number;
    sizeMultiplier: number;
    consecutiveProfitDays: number;
    restDeclaredAt?: Date;
    pastSimilarCount?: number;
    pastSimilarLossAvg?: number;
  };
}

export async function detectEmergency(
  userId: string,
  position: {
    exchange: string;
    symbol: string;
    side: "long" | "short";
    size: number;        // USDT 기준
    openedAt: number;
  }
): Promise<EmergencyDecision> {
  // 1. Baseline 조회
  const baseline = await prisma.userBaseline.findUnique({
    where: { userId_exchange: { userId, exchange: position.exchange } }
  });

  if (!baseline || baseline.sampleSize < 5) {
    // 데이터 부족 → 발동 안 함
    return { level: 0, triggers: [], context: {} };
  }

  const triggers: EmergencyTrigger[] = [];
  const sizeMultiplier = position.size / baseline.avgPositionSize;

  // 2. 사이즈 트리거
  if (sizeMultiplier >= 5) triggers.push("size_multiplier_high");
  else if (sizeMultiplier >= 2) triggers.push("size_multiplier_mid");
  else if (sizeMultiplier >= 1.5) triggers.push("size_multiplier_low");

  // 3. 휴식 선언 위반 체크
  const activeRest = await prisma.restDeclaration.findFirst({
    where: {
      userId,
      expiresAt: { gt: new Date() },
      cancelledAt: null
    }
  });
  if (activeRest) triggers.push("rest_declared_violated");

  // 4. 연속 흑자 + 큰 사이즈
  if (baseline.consecutiveProfitDays >= 7 && sizeMultiplier >= 2) {
    triggers.push("consecutive_profit_break");
  }

  // 5. 시간대 체크
  const hour = new Date(position.openedAt).getHours();
  const riskyHours = baseline.riskyHours as number[];
  if (riskyHours.includes(hour)) triggers.push("risky_time_window");

  // 6. 요일 체크
  const dayOfWeek = new Date(position.openedAt).getDay();
  const riskyDays = baseline.riskyDaysOfWeek as number[];
  if (riskyDays.includes(dayOfWeek)) triggers.push("risky_day_of_week");

  // 7. Level 판단
  const level = decideLevel(triggers, sizeMultiplier);

  // 8. 과거 유사 패턴 조회 (선택)
  const pastSimilar = await findSimilarPastPatterns(userId, triggers, position);

  return {
    level,
    triggers,
    context: {
      avgSize: baseline.avgPositionSize,
      sizeMultiplier,
      consecutiveProfitDays: baseline.consecutiveProfitDays,
      restDeclaredAt: activeRest?.declaredAt,
      pastSimilarCount: pastSimilar?.count,
      pastSimilarLossAvg: pastSimilar?.avgLoss
    }
  };
}

function decideLevel(triggers: EmergencyTrigger[], sizeMultiplier: number): 0 | 1 | 2 | 3 {
  // 5배 이상 또는 휴식 위반 + 다른 트리거 = Level 3
  if (triggers.includes("size_multiplier_high")) return 3;
  if (triggers.includes("rest_declared_violated") && triggers.length >= 2) return 3;

  // 2~5배 또는 휴식 위반 단독 = Level 2
  if (triggers.includes("size_multiplier_mid")) return 2;
  if (triggers.includes("rest_declared_violated")) return 2;

  // 1.5~2배 + 다른 트리거 = Level 2
  if (triggers.includes("size_multiplier_low") && triggers.length >= 2) return 2;

  // 1.5~2배 단독 = Level 1
  if (triggers.includes("size_multiplier_low")) return 1;

  return 0;
}
```

### 3-2. 과거 유사 패턴 분석

같은 트리거 조합으로 진입했던 과거 거래의 결과를 분석:

```typescript
async function findSimilarPastPatterns(
  userId: string,
  triggers: EmergencyTrigger[],
  position: { ... }
): Promise<{ count: number; avgLoss: number } | null> {
  // 과거 EmergencyAlertSession 중 동일한 trigger 조합 + userAction이 "ignored" 또는 "kept" 인 것
  // 해당 positionId의 최종 손익 조회

  // 단순화 버전: 최근 90일 종료 포지션 중 size가 1.5배 이상이었던 것들의 평균 손익
  // ...

  return { count: 3, avgLoss: -12.4 };
}
```

---

## E4. 알림 시퀀스 6종 템플릿

### 4-1. 메시지 템플릿

`src/lib/emergency-templates.ts`:

```typescript
import { escapeMarkdownV2 } from "./telegram-utils";

export interface EmergencyContext {
  symbol: string;
  side: string;
  size: number;
  avgSize: number;
  sizeMultiplier: number;
  consecutiveProfitDays: number;
  restDeclaredAt?: Date;
  pastSimilarCount?: number;
  pastSimilarLossAvg?: number;
  sessionId: string;
}

export function buildStep1Alert(ctx: EmergencyContext): TelegramMessage {
  return {
    text: `🚨🚨🚨 *큰 사이즈 진입 감지*

방금 ${ctx.symbol} ${ctx.side === "long" ? "Long" : "Short"} *${ctx.size} USDT* 진입
\\(평소 평균 *${ctx.avgSize.toFixed(1)} USDT*의 ${ctx.sizeMultiplier.toFixed(1)}배\\)

잠깐, 정말 의도한 사이즈인가요?`,
    parseMode: "MarkdownV2",
    inlineKeyboard: [
      [
        { text: "🛑 비트겟에서 청산하기", callback_data: `emergency_close_${ctx.sessionId}` },
        { text: "차트 다시 보기", url: "https://www.bitget.com/futures/usdt/" + ctx.symbol }
      ]
    ]
  };
}

export function buildStep2Alert(ctx: EmergencyContext): TelegramMessage {
  return {
    text: `🛑 *3초 안에 청산하면 손실 최소*

슬리피지가 작은 지금이 청산 골든타임입니다\\.

진입 후 30초가 지나면 시장이 움직여
돌이키기 어려워질 수 있습니다\\.`,
    parseMode: "MarkdownV2",
    inlineKeyboard: [
      [{ text: "🛑 지금 청산", callback_data: `emergency_close_${ctx.sessionId}` }]
    ]
  };
}

export function buildStep3Alert(ctx: EmergencyContext): TelegramMessage {
  return {
    text: `📊 *${ctx.consecutiveProfitDays}일 연속 흑자 기록이 깨질 위험*

오늘까지 ${ctx.consecutiveProfitDays}일 연속 흑자\\.
어제까지의 성실함을 기억하세요\\.

이번 한 번의 큰 매매로 무너질 수 있습니다\\.`,
    parseMode: "MarkdownV2"
  };
}

export function buildStep4Alert(ctx: EmergencyContext): TelegramMessage {
  if (!ctx.pastSimilarCount || ctx.pastSimilarCount === 0) {
    return buildStep4AltAlert(ctx);  // 과거 데이터 없으면 다른 메시지
  }

  return {
    text: `⚠️ *과거 데이터 경고*

비슷한 조건에서
과거 ${ctx.pastSimilarCount}회 매매 모두 큰 손실로 끝났습니다\\.

• 평균 손실: ${ctx.pastSimilarLossAvg?.toFixed(1)}\\%

같은 패턴 ${ctx.pastSimilarCount + 1}번째 시도일 가능성이 높습니다\\.`,
    parseMode: "MarkdownV2"
  };
}

export function buildStep5Alert(ctx: EmergencyContext): TelegramMessage {
  return {
    text: `📖 *코치의 말*

잠깐 차트에서 눈을 떼세요\\.

화장실 다녀오시거나 물 한 잔 마시세요\\.
1분 후 다시 결정하셔도 늦지 않습니다\\.

좋은 매매는 절대 "지금 당장"이 아닙니다\\.
좋은 매매는 "준비된 순간"입니다\\.

오늘 이 매매, 정말 준비됐나요?`,
    parseMode: "MarkdownV2"
  };
}

export function buildStep6Alert(ctx: EmergencyContext): TelegramMessage {
  return {
    text: `⏰ *마지막 확인*

1분이 지났습니다\\. 지금 결정하세요:

어떤 선택이든 데이터로 기록됩니다\\.
자기 자신을 정직하게 마주하세요\\.`,
    parseMode: "MarkdownV2",
    inlineKeyboard: [
      [{ text: "🛑 청산하기", callback_data: `emergency_close_${ctx.sessionId}` }],
      [{ text: "😤 그래도 진행", callback_data: `emergency_keep_${ctx.sessionId}` }]
    ]
  };
}

export function buildStep7FollowUp(
  ctx: EmergencyContext,
  currentStatus: { stillOpen: boolean; pnl?: number; pnlPercent?: number }
): TelegramMessage {
  if (!currentStatus.stillOpen) {
    return {
      text: `✅ *5분 경과 — 잘 결정하셨습니다*

방금 큰 매매를 청산하셨습니다\\.
충동을 이긴 자기 자신을 칭찬하세요\\.

오늘의 결정이 한 달 후 큰 수익을 지키는 행동이 될 것입니다\\.`,
      parseMode: "MarkdownV2"
    };
  }

  return {
    text: `💬 *5분 경과 — 상황 점검*

방금 큰 매매 이후 5분이 지났습니다\\.

현재 상태:
• 포지션: ${ctx.symbol} ${ctx.side === "long" ? "Long" : "Short"} ${ctx.size} USDT \\(유지 중\\)
• 현재 PnL: ${currentStatus.pnl?.toFixed(2)} USDT \\(${currentStatus.pnlPercent?.toFixed(1)}\\%\\)

SL 설정은 했나요?
없으면 지금이라도 설정하세요\\.`,
    parseMode: "MarkdownV2"
  };
}
```

### 4-2. Level별 시퀀스 정의

```typescript
export interface AlertSequenceStep {
  step: number;
  delayMs: number;
  builder: (ctx: EmergencyContext) => TelegramMessage;
}

export function getSequenceForLevel(level: 1 | 2 | 3): AlertSequenceStep[] {
  if (level === 1) {
    return [
      { step: 1, delayMs: 1000, builder: buildStep1Alert }
    ];
  }

  if (level === 2) {
    return [
      { step: 1, delayMs: 1000, builder: buildStep1Alert },
      { step: 2, delayMs: 4000, builder: buildStep2Alert },
      { step: 3, delayMs: 10000, builder: buildStep3Alert }
    ];
  }

  // Level 3 (전체 시퀀스)
  return [
    { step: 1, delayMs: 1000, builder: buildStep1Alert },
    { step: 2, delayMs: 4000, builder: buildStep2Alert },
    { step: 3, delayMs: 10000, builder: buildStep3Alert },
    { step: 4, delayMs: 20000, builder: buildStep4Alert },
    { step: 5, delayMs: 35000, builder: buildStep5Alert },
    { step: 6, delayMs: 60000, builder: buildStep6Alert },
    { step: 7, delayMs: 5 * 60 * 1000, builder: ctx => buildStep7FollowUp(ctx, { stillOpen: true }) }
  ];
}
```

---

## E5. 알림 스케줄러 + Cron

### 5-1. 시퀀스 시작 함수

`src/lib/emergency-scheduler.ts`:

```typescript
export async function startEmergencySequence(
  userId: string,
  position: { ... },
  decision: EmergencyDecision
): Promise<void> {
  if (decision.level === 0) return;

  // 세션 생성
  const session = await prisma.emergencyAlertSession.create({
    data: {
      userId,
      positionId: position.positionId,
      exchange: position.exchange,
      symbol: position.symbol,
      side: position.side,
      size: position.size,
      sizeMultiplier: decision.context.sizeMultiplier,
      level: decision.level,
      triggers: decision.triggers,
      context: decision.context
    }
  });

  const sequence = getSequenceForLevel(decision.level);
  const now = Date.now();

  // 첫 알림 즉시 발송
  const firstStep = sequence[0];
  const firstMsg = firstStep.builder({ ...decision.context, sessionId: session.id, ... });
  await sendTelegramMessage(chatId, firstMsg.text, { parseMode: firstMsg.parseMode, inlineKeyboard: firstMsg.inlineKeyboard });

  await prisma.emergencyAlertSession.update({
    where: { id: session.id },
    data: { alertsSent: 1 }
  });

  // 나머지는 DB에 예약 저장
  for (const step of sequence.slice(1)) {
    await prisma.emergencyScheduledAlert.create({
      data: {
        sessionId: session.id,
        step: step.step,
        scheduledAt: new Date(now + step.delayMs),
        status: "pending"
      }
    });
  }
}
```

### 5-2. Cron 처리기

`src/app/api/cron/emergency-queue/route.ts`:

```typescript
// 매분 실행 (vercel.json):
// { "path": "/api/cron/emergency-queue", "schedule": "* * * * *" }

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 발송 시각 도래 + pending 상태 알림 조회
  const dueAlerts = await prisma.emergencyScheduledAlert.findMany({
    where: {
      status: "pending",
      scheduledAt: { lte: new Date() }
    },
    include: { session: { include: { user: true } } },
    take: 50
  });

  for (const alert of dueAlerts) {
    try {
      // 세션이 이미 취소됐는지 체크
      if (alert.session.cancelledAt) {
        await prisma.emergencyScheduledAlert.update({
          where: { id: alert.id },
          data: { status: "cancelled" }
        });
        continue;
      }

      // 사용자가 이미 청산했는지 체크 (포지션 상태 조회)
      const stillOpen = await checkPositionStillOpen(
        alert.session.userId,
        alert.session.exchange,
        alert.session.positionId
      );

      if (!stillOpen && alert.step < 7) {
        // 사용자가 직접 청산함 → 후속 알림 모두 취소
        await prisma.emergencyAlertSession.update({
          where: { id: alert.session.id },
          data: { userAction: "closed", cancelledAt: new Date() }
        });
        await prisma.emergencyScheduledAlert.updateMany({
          where: { sessionId: alert.session.id, status: "pending" },
          data: { status: "cancelled" }
        });

        // 칭찬 메시지 1회 발송
        await sendCloseConfirmation(alert.session);
        continue;
      }

      // 알림 발송
      const sequence = getSequenceForLevel(alert.session.level);
      const stepDef = sequence.find(s => s.step === alert.step);
      if (!stepDef) continue;

      const ctx = buildContext(alert.session);
      const msg = stepDef.builder(ctx);

      const setting = await prisma.notificationSetting.findUnique({
        where: { userId: alert.session.userId }
      });
      if (setting?.telegramChatId) {
        await sendTelegramMessage(setting.telegramChatId, msg.text, {
          parseMode: msg.parseMode,
          inlineKeyboard: msg.inlineKeyboard
        });
      }

      // step 7 (5분 후 후속)인 경우 현재 PnL 조회해서 다시 보내기
      if (alert.step === 7) {
        const status = await getPositionStatus(...);
        const followUp = buildStep7FollowUp(ctx, status);
        if (setting?.telegramChatId) {
          await sendTelegramMessage(setting.telegramChatId, followUp.text, ...);
        }
      }

      await prisma.emergencyScheduledAlert.update({
        where: { id: alert.id },
        data: { status: "sent", sentAt: new Date() }
      });
      await prisma.emergencyAlertSession.update({
        where: { id: alert.session.id },
        data: { alertsSent: { increment: 1 } }
      });
    } catch (e) {
      console.error("emergency alert send failed", e);
    }
  }

  return NextResponse.json({ processed: dueAlerts.length });
}
```

`vercel.json`에 cron 추가:
```json
{
  "path": "/api/cron/emergency-queue",
  "schedule": "* * * * *"
}
```

---

## E6. Callback 처리 (청산 버튼)

### 6-1. Webhook 확장

기존 `src/app/api/notifications/telegram/webhook/route.ts`에 callback_query 처리 추가:

```typescript
if (update.callback_query) {
  const data = update.callback_query.data;
  const callbackQueryId = update.callback_query.id;
  const fromId = update.callback_query.from.id.toString();

  // 사용자 식별
  const setting = await prisma.notificationSetting.findFirst({
    where: { telegramChatId: fromId }
  });
  if (!setting) return acknowledgeCallback(callbackQueryId);

  if (data.startsWith("emergency_close_")) {
    const sessionId = data.replace("emergency_close_", "");
    await handleEmergencyClose(sessionId, setting.userId, callbackQueryId);
    return NextResponse.json({ ok: true });
  }

  if (data.startsWith("emergency_keep_")) {
    const sessionId = data.replace("emergency_keep_", "");
    await handleEmergencyKeep(sessionId, setting.userId, callbackQueryId);
    return NextResponse.json({ ok: true });
  }
}

async function handleEmergencyClose(sessionId: string, userId: string, callbackQueryId: string) {
  // 세션 검증
  const session = await prisma.emergencyAlertSession.findUnique({
    where: { id: sessionId }
  });
  if (!session || session.userId !== userId) return;

  // userAction 기록
  await prisma.emergencyAlertSession.update({
    where: { id: sessionId },
    data: { userAction: "user_closing", cancelledAt: new Date() }
  });

  // 후속 알림 모두 취소
  await prisma.emergencyScheduledAlert.updateMany({
    where: { sessionId, status: "pending" },
    data: { status: "cancelled" }
  });

  // 텔레그램에 confirmation
  await answerCallbackQuery(callbackQueryId, "잘 결정하셨습니다. 비트겟 앱으로 이동하세요.");
}

async function handleEmergencyKeep(sessionId: string, userId: string, callbackQueryId: string) {
  await prisma.emergencyAlertSession.update({
    where: { id: sessionId },
    data: { userAction: "kept" }
  });
  // 후속 알림은 계속 진행 (사용자가 의식적으로 진행 선택했어도 5분 후 follow-up은 유지)
  await answerCallbackQuery(callbackQueryId, "이 매매는 사후 회고 대상으로 기록됩니다.");
}
```

### 6-2. answerCallbackQuery 유틸

`src/lib/telegram.ts`에 추가:

```typescript
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string
): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: !!text
      })
    });
    return res.ok;
  } catch (e) {
    console.error("answerCallbackQuery failed", e);
    return false;
  }
}
```

---

## E7. "오늘 휴식" 토글 UI

### 7-1. API 라우트

`src/app/api/rest-declaration/route.ts`:

```typescript
// GET: 현재 활성 휴식 선언 조회
export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const active = await prisma.restDeclaration.findFirst({
    where: {
      userId: session.user.id,
      expiresAt: { gt: new Date() },
      cancelledAt: null
    },
    orderBy: { declaredAt: "desc" }
  });

  return NextResponse.json({ active });
}

// POST: 휴식 선언 시작
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { hours, reason } = await request.json();
  const validHours = [1, 3, 6, 12, 24];
  if (!validHours.includes(hours)) {
    return NextResponse.json({ error: "Invalid hours" }, { status: 400 });
  }

  const declaration = await prisma.restDeclaration.create({
    data: {
      userId: session.user.id,
      expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
      reason
    }
  });

  return NextResponse.json({ declaration });
}

// DELETE: 휴식 선언 해제
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const active = await prisma.restDeclaration.findFirst({
    where: {
      userId: session.user.id,
      expiresAt: { gt: new Date() },
      cancelledAt: null
    }
  });

  if (active) {
    await prisma.restDeclaration.update({
      where: { id: active.id },
      data: { cancelledAt: new Date() }
    });
  }

  return NextResponse.json({ ok: true });
}
```

### 7-2. 대시보드 위젯

`src/app/dashboard/_components/RestModeToggle.tsx`:

```tsx
"use client";
// 대시보드 상단에 표시되는 휴식 모드 토글
// 활성 중: "😴 휴식 중 (남은 시간: 11:42:30)" + 해제 버튼
// 비활성: "[😴 오늘 휴식 선언]" 버튼

export function RestModeToggle() {
  const [active, setActive] = useState<RestDeclaration | null>(null);
  const [showModal, setShowModal] = useState(false);

  // 1분마다 남은 시간 갱신
  // 활성 상태에서 expiresAt 도달 시 자동 비활성화

  return active ? (
    <div className="rest-active">
      <span>😴 휴식 중 (남은 시간: {formatRemaining(active.expiresAt)})</span>
      <button onClick={handleCancel}>해제</button>
    </div>
  ) : (
    <button onClick={() => setShowModal(true)}>😴 오늘 휴식 선언</button>
  );
}
```

선택 모달:
- 1시간 / 3시간 / 6시간 / 12시간 / 24시간
- 사유 입력 (선택)
- "이 시간 동안 매매하면 강력한 경고가 발송됩니다" 안내

---

## E8. Emergency 설정 페이지

`src/app/settings/emergency/page.tsx`:

```tsx
// 사용자가 Emergency Brake 동작 조정하는 페이지

섹션 1: 활성화 토글
- Emergency Brake 사용 여부

섹션 2: 강도 조절
- Off / Mild / Standard / Aggressive

섹션 3: 트리거 임계값
- Level 1 발동: 평소 사이즈 ___배 (기본 1.5, 1.0~3.0 슬라이더)
- Level 2 발동: ___배 (기본 2.0)
- Level 3 발동: ___배 (기본 5.0)

섹션 4: 작동 시간대
- 24시간 (기본) / 특정 시간대만
- 시간대 설정 시 시작/종료 입력

섹션 5: 강제 문장 (선택)
- 기본: "원칙을 지켜야 살아남는다"
- 커스터마이즈 가능

섹션 6: 통계
- 이번 달 Emergency 발동 횟수
- 사용자 청산 비율
- "이 기능으로 추정 손실 회피액: -XX USDT"

섹션 7: 일시 비활성화
- 15분 / 1시간 / 24시간
- 사유 입력 필수
```

API:
- GET `/api/settings/emergency` — 설정 조회
- PUT `/api/settings/emergency` — 설정 수정

DB에 EmergencySetting 모델 추가 또는 NotificationSetting에 필드 추가.

---

## E9. 통합 — 위험 감지 자동갱신 통합

### 9-1. 신규 포지션 감지 시 발동

기존 `src/app/api/exchange/positions/route.ts` 또는 자동갱신 로직에서:

```typescript
// 신규 오픈 포지션 감지 시
for (const newPosition of newlyOpenedPositions) {
  // 1. 사용자 활성화 여부 확인
  const setting = await prisma.emergencySetting.findUnique({
    where: { userId }
  });
  if (!setting?.enabled) continue;

  // 2. 작동 시간대 확인
  if (!isInActiveHours(setting)) continue;

  // 3. 위험 감지
  const decision = await detectEmergency(userId, {
    exchange: newPosition.exchange,
    symbol: newPosition.symbol,
    side: newPosition.side,
    size: newPosition.margin,  // USDT 기준 마진
    openedAt: newPosition.openedAt
  });

  // 4. 발동
  if (decision.level >= 1) {
    await startEmergencySequence(userId, newPosition, decision);
  }
}
```

### 9-2. 중복 발동 방지

같은 positionId로 5분 내 중복 발동 안 되도록:

```typescript
const recentSession = await prisma.emergencyAlertSession.findFirst({
  where: {
    userId,
    positionId: newPosition.positionId,
    startedAt: { gt: new Date(Date.now() - 5 * 60 * 1000) }
  }
});
if (recentSession) continue;  // 이미 발동됨
```

---

## 작업 후 점검

모든 단계 완료 후:

1. `npm run build` 실행
2. 빌드 성공 확인
3. 변경/생성 파일 목록 보고
4. 진행 상태 표 업데이트 (✅ 완료)
5. 통합 테스트 가능한지 안내

### 통합 테스트 시나리오

수동 테스트 가능:
1. 대시보드에서 "오늘 휴식 선언" 클릭
2. 비트겟에서 작은 사이즈 진입 (테스트용)
3. 5초~1분 동안 텔레그램 알림 6개 도착 확인
4. 청산 버튼 클릭 → 시퀀스 중단 확인
5. 다음 날 자동 baseline 계산 확인

---

## 주의사항

- 모든 알림은 try/catch로 감싸 앱이 죽지 않도록
- 텔레그램 API rate limit 주의 (분당 30개) — 같은 사용자에게 1초 간격 발송 안전
- baseline.sampleSize < 5인 사용자는 발동 안 함 (신규 사용자 보호)
- false positive 방지: size_multiplier 계산 시 medianPositionSize도 함께 비교
- 사용자가 의도적으로 큰 매매 (큰 신호 포착) 한 경우 — "일시 비활성화" 기능으로 우회 가능
- CRON_SECRET 검증 누락하지 않도록 모든 cron 라우트에 적용

---

## 작업 순서 권장

```
E1 (UserBaseline 모델 + 계산)
  → 빌드 확인
E2 (EmergencyAlertSession 모델)
  → 빌드 확인
E3 (위험 감지 로직)
  → 빌드 확인
E4 (메시지 템플릿 6종)
  → 빌드 확인
E5 (스케줄러 + Cron)
  → 빌드 확인
E6 (Callback 처리)
  → 빌드 확인
E7 (휴식 토글 UI)
  → 빌드 확인
E8 (설정 페이지)
  → 빌드 확인
E9 (자동갱신 통합)
  → 빌드 확인
  → 최종 완료 보고
```

---

**이 PHASE_E_TELEGRAM.md를 읽고 자동 진행해줘.**
