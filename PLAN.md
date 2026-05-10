# Futures Journal — 개발 계획서

> Claude Code 자동 진행용 계획서. 각 Phase를 순서대로 완료하고 PLAN.md에 진행 상태를 업데이트한다.

---

## 자동 진행 규칙

1. 아직 완료 안 된 Phase부터 순서대로 진행
2. 각 Phase 시작 시 `[진행중]` 표시
3. 완료 시 `✅ 완료` 표시
4. 각 Phase 끝나면 `npm run build` 실행해서 빌드 에러 없는지 확인
5. 빌드 성공 시 자동으로 다음 Phase 진행
6. 빌드 실패 시 멈추고 에러 보고
7. 각 Phase 완료 시 변경 파일 목록을 1~2줄로 요약
8. 완료 후 다음 Phase 자동 시작

## 멈추고 사용자에게 물어봐야 하는 경우

- DB 마이그레이션 충돌
- 환경변수 추가 필요 (사용자가 .env 수정해야 할 때)
- 외부 서비스 가입 필요 (텔레그램 봇 토큰 등)
- 디자인 결정이 모호한 경우

---

## 진행 상태

| Phase | 작업 | 상태 |
|-------|------|------|
| 1 | 통계 인사이트 API | ✅ 완료 |
| 2 | 통계 대시보드 UI | ✅ 완료 |
| 3 | 리스크 룰 시스템 (DB + API) | ✅ 완료 |
| 4 | 리스크 룰 UI | ✅ 완료 (보완) |
| 5 | AI 주간 리포트 (백엔드) | ✅ 완료 (보완) |
| 6 | AI 주간 리포트 (UI) | ✅ 완료 (보완) |
| 7 | 텔레그램 봇 알림 | ⏸ 보류 |
| 8 | 데이터 Export (CSV/Excel) | ✅ 완료 (보완) |
| 9 | 모바일 PWA 변환 | ✅ 완료 (보완) |
| 10 | 마일스톤 시스템 | ✅ 완료 (보완) |
| 11 | AI 채팅 코치 | ✅ 완료 (보완) |
| 12 | 가격 정책 / 구독 시스템 | ✅ 완료 (보완) |
| 13 | Vercel 배포 준비 | ⏳ 대기 |

---

## Phase 4 — 리스크 룰 시스템 UI

### 4-1. 룰 관리 페이지

`src/app/rules/page.tsx` (서버 컴포넌트)
- 세션 확인, 미로그인 시 /login 리다이렉트
- RulesContent 클라이언트 컴포넌트 렌더링

`src/app/rules/_components/RulesContent.tsx` (클라이언트)
- 상단: "+ 새 룰 추가" 버튼
- 등록된 룰 목록 카드 그리드
- 각 카드: 룰 타입 아이콘 + 한국어 라벨, 설정 요약, 토글 스위치, 수정/삭제 버튼, 이번 달 위반 횟수 뱃지

### 4-2. 룰 추가/수정 모달

`src/app/rules/_components/RuleFormModal.tsx`

1단계: 룰 타입 선택 (6개 카드 그리드)
- time_block, cooldown, daily_limit, psych_block, liq_distance, loss_streak
- 각 카드: 아이콘 + 라벨 + 한 줄 설명

2단계: 룰별 설정 입력 폼
- time_block: 24시간 시각 다중 선택
- cooldown: 분 입력 + "손실 후" / "모든 거래 후" 토글
- daily_limit: 손실률 % 입력 (1~20)
- psych_block: 차단할 심리 상태 체크박스
- liq_distance: 최소 거리 % 입력 (1~20)
- loss_streak: 횟수 + 휴식 분 입력

저장 시 POST /api/rules 또는 PUT /api/rules/[id]

### 4-3. 위반 내역 페이지

`src/app/rules/violations/page.tsx` + `ViolationsContent.tsx`
- 상단 통계 카드 4개: 총 위반 횟수, 위반 거래 평균 손익, 준수 거래 평균 손익, 개선 가능 %p
- 룰 종류별 위반 통계 표
- 위반 기록 타임라인
- 인사이트 박스 (CTA)

### 4-4. 라이브 위험 모니터 위젯

`src/app/dashboard/_components/RiskMonitor.tsx`
- 대시보드 상단 항상 표시
- 상태별 색상: 🟢 안전 / 🟡 주의 / 🔴 위험
- 표시: 시간대 룰 상태, 오늘 거래 횟수/손익, 일일 한도 진행도, 마지막 거래 후 경과 시간
- 룰 0개일 때 CTA 표시

### 4-5. 메모 모달에 위반 표시

기존 `MemoModal.tsx`에 룰 위반 경고 배너 추가
- 해당 포지션이 룰 위반에 해당되면 상단에 빨간 경고 배너

### 4-6. 네비게이션

대시보드 헤더에 "룰" 메뉴 추가, 경로 /rules
hover 시 드롭다운: "룰 관리 / 위반 내역"

### 디자인 가이드
- 기존 톤 유지 (Tailwind v4, 다크모드)
- 룰 타입별 컬러 차별화
- 모바일 반응형
- 토글 스위치, 카드 호버, 모달 애니메이션 디테일

---

## Phase 5 — AI 주간 리포트 (백엔드)

### 5-1. AIReport 모델 활용

기존 AIReport 모델 사용 (Phase 1에서 생성됨)
- type: "weekly_report" | "monthly_report"

### 5-2. 주간 리포트 생성 API

`src/app/api/reports/weekly/route.ts`

POST: 새 리포트 생성
- 최근 7일 데이터 수집 (포지션 내역, 메모, 룰 위반)
- Claude API (claude-sonnet-4-6) 호출
- 크레딧 30개 차감 (수동 생성 시)
- AIReport에 저장 후 반환

GET: 내 주간 리포트 목록 조회 (최신순)

`src/app/api/reports/[id]/route.ts`
- GET: 특정 리포트 상세 조회

### 5-3. AI 프롬프트 설계

`src/lib/ai-prompts.ts`에 주간 리포트 프롬프트 추가

입력 데이터:
- 기간 (시작/종료)
- 거래 횟수, 승률, 순손익
- 패턴 매트릭스 데이터 (진입이유 × 심리)
- 시간대별 통계
- 심볼별 통계
- 룰 위반 기록
- 사용자 메모 모음

출력 JSON 구조:
```json
{
  "summary": {
    "trades": 23,
    "winRate": 56,
    "winRateChange": 4,
    "totalPnl": 47,
    "totalPnlPercent": 10.0
  },
  "highlights": [
    "월요일~수요일 룰 준수율 100% 달성",
    "EMA 신호 진입 승률 78% (전주 65%)"
  ],
  "improvements": [
    {
      "issue": "목요일 새벽 거래 4회, 전부 손실",
      "suggestion": "다음 주 23시 이후 거래 자제"
    }
  ],
  "nextWeekGoals": [
    "23시 이후 거래 0회",
    "손절 후 30분 쿨다운 100% 준수",
    "ETH 비중 늘리기"
  ],
  "coachComment": "심리 관리가 좋아지셨습니다..."
}
```

### 5-4. 자동 생성 Cron

`src/app/api/cron/weekly-reports/route.ts`
- Vercel Cron 또는 자체 스케줄러
- 매주 일요일 23:00 실행
- 활성 사용자 전체에 대해 자동 리포트 생성
- 무료 사용자는 미리보기만, 유료 사용자는 전체 리포트
- 인증: CRON_SECRET 환경변수로 보호

### 5-5. 월간 리포트

`src/app/api/reports/monthly/route.ts`
- 주간 리포트와 유사하지만 30일 데이터
- 월별 변화 추세 분석
- 매월 1일 자동 생성

---

## Phase 6 — AI 주간 리포트 UI

### 6-1. 리포트 목록 페이지

`src/app/reports/page.tsx`
- 내 리포트 목록 (주간 + 월간)
- 카드형 그리드, 각 카드: 기간, 핵심 지표, "보기" 버튼
- 상단: "새 리포트 생성" 버튼 (크레딧 차감 안내)

### 6-2. 리포트 상세 페이지

`src/app/reports/[id]/page.tsx`
- 헤더: 기간, 생성일
- 섹션 구성:
  · 핵심 지표 (큰 숫자 카드)
  · 🌟 잘한 점 (초록 박스)
  · ⚠️ 개선할 점 (노란 박스)
  · 💡 다음 주 목표 (파란 박스)
  · 📖 코치의 한 마디 (감성 디자인)

### 6-3. 공유 기능

- 리포트 카드 이미지 다운로드 (html2canvas)
- "내 리포트 보기" 공개 링크 생성 (옵션)

---

## Phase 7 — 텔레그램 봇 알림

### 7-1. NotificationSetting 모델 추가

```prisma
model NotificationSetting {
  id              String  @id @default(cuid())
  userId          String  @unique
  user            User    @relation(fields: [userId], references: [id])
  telegramChatId  String?
  emailEnabled    Boolean @default(true)
  ruleViolation   Boolean @default(true)
  largeLoss       Boolean @default(true)
  liquidationRisk Boolean @default(true)
  memoReminder    Boolean @default(false)
  weeklyReport    Boolean @default(true)
  milestoneAlert  Boolean @default(true)
}
```

### 7-2. 텔레그램 봇 연동

`src/lib/telegram.ts`
- sendMessage(chatId, message) 함수
- BOT_TOKEN 환경변수 사용

`src/app/api/notifications/telegram/connect/route.ts`
- POST: 텔레그램 연동 시작 (deep link 생성)
- GET: 연동 상태 확인

`src/app/api/telegram/webhook/route.ts`
- 텔레그램 봇 webhook 수신
- /start 명령어로 chatId 등록

### 7-3. 알림 발송 로직

`src/lib/notifications.ts`
- notifyRuleViolation(userId, rule, position)
- notifyLargeLoss(userId, position)
- notifyLiquidationRisk(userId, position)
- notifyMemoReminder(userId, position)
- notifyWeeklyReport(userId, report)
- notifyMilestone(userId, milestone)

각 함수는 NotificationSetting 확인 후 발송 여부 결정.

### 7-4. 알림 설정 페이지

`src/app/settings/notifications/page.tsx`
- 텔레그램 연동 상태 표시
- 연동 버튼 ("텔레그램 봇과 채팅하기" deep link)
- 알림 종류별 토글 6개

### 7-5. 환경변수 추가 필요

⚠️ 멈추고 사용자에게 물어봐야 함:
- TELEGRAM_BOT_TOKEN — BotFather에서 봇 생성 후 발급
- 사용자가 .env에 추가하도록 안내

---

## Phase 8 — 데이터 Export

### 8-1. CSV Export

`src/app/api/export/csv/route.ts`
- 쿼리: ?type=orders|positions|memos&from=&to=
- CSV 생성 후 다운로드 응답
- Content-Disposition: attachment

### 8-2. Excel Export

`src/app/api/export/excel/route.ts`
- exceljs 라이브러리 설치
- 시트 구성: 주문 / 포지션 / 메모 / 월별 요약
- 차트 포함 (승률, 손익 그래프)
- 세금 신고용 시트 (월별 실현 손익)

### 8-3. JSON Export (백업용)

`src/app/api/export/json/route.ts`
- 사용자의 모든 데이터 JSON 백업

### 8-4. Export UI

`src/app/settings/export/page.tsx`
- 형식 선택 (CSV / Excel / JSON)
- 데이터 종류 선택
- 기간 선택
- 다운로드 버튼

---

## Phase 9 — 모바일 PWA 변환

### 9-1. PWA 설정

next-pwa 패키지 설치

`next.config.js` 수정
```javascript
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development'
});
module.exports = withPWA({ ... });
```

### 9-2. manifest.json

`public/manifest.json` 생성
- name, short_name, icons (192, 512)
- theme_color, background_color
- start_url, display: standalone

### 9-3. 아이콘 생성

`public/icon-192.png`, `public/icon-512.png` 생성

`src/app/layout.tsx`에 manifest 링크 추가

### 9-4. 모바일 UI 점검

- 모든 페이지 모바일 반응형 확인
- 테이블 가로 스크롤
- 버튼 터치 영역 44x44 이상
- 메뉴는 햄버거로 변경 (모바일)

### 9-5. 푸시 알림 (옵션)

Web Push API 연동
- 룰 위반 시 즉시 푸시
- 주간 리포트 도착 알림

---

## Phase 10 — 마일스톤 시스템

### 10-1. Milestone 모델 추가

```prisma
model Milestone {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  type       String
  metadata   Json?
  achievedAt DateTime @default(now())

  @@unique([userId, type])
}
```

### 10-2. 마일스톤 정의

`src/lib/milestones.ts`
- first_100_rule_compliance: 첫 100% 룰 준수 주
- 7day_streak: 7일 연속 흑자
- 14day_streak: 14일 연속 흑자
- monthly_10_percent: 월 수익률 +10%
- fomo_zero_week: FOMO 거래 1주일 0회
- 100_trades: 누적 100거래
- 등등

각 마일스톤마다 체크 함수, 라벨, 아이콘 정의.

### 10-3. 마일스톤 체크 로직

`src/lib/milestone-checker.ts`
- 매번 새 거래/메모 추가될 때 체크
- 달성 시 Milestone 레코드 생성 + 알림 발송

### 10-4. 마일스톤 UI

`src/app/dashboard/_components/MilestoneShowcase.tsx`
- 대시보드 사이드바에 표시
- 달성한 마일스톤 5개 표시
- "다음 목표" 진행도 바

`src/app/milestones/page.tsx`
- 전체 마일스톤 갤러리
- 달성/미달성 구분

---

## Phase 11 — AI 채팅 코치

### 11-1. 채팅 위젯

`src/app/dashboard/_components/AICoachWidget.tsx`
- 대시보드 우측 하단 떠있는 채팅 버튼
- 클릭 시 채팅 창 열림

`src/app/dashboard/_components/AICoachChat.tsx`
- 메시지 목록 (사용자 / AI)
- 입력창 + 전송 버튼
- 빠른 질문 칩 ("내 약점이 뭐야?", "이번 주 어땠어?", "다음 거래 조언")

### 11-2. 채팅 API

`src/app/api/ai/coach-chat/route.ts`
- POST: 메시지 전송
- 세션 컨텍스트 유지 (대화 히스토리 포함)
- 사용자 데이터 자동 주입 (최근 통계, 메모 요약)
- Claude API 스트리밍 응답
- 크레딧 차감 (메시지당 5크레딧)

### 11-3. 대화 히스토리 저장

`ChatMessage` 모델 추가
```prisma
model ChatMessage {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  role      String   // "user" | "assistant"
  content   String
  createdAt DateTime @default(now())

  @@index([userId, createdAt])
}
```

### 11-4. 채팅 페이지

`src/app/coach/page.tsx`
- 풀 페이지 채팅
- 대화 히스토리 좌측 사이드바
- 새 대화 시작 버튼

---

## Phase 12 — 가격 정책 / 구독 시스템

### 12-1. Plan 모델 추가

```prisma
model Subscription {
  id           String    @id @default(cuid())
  userId       String    @unique
  user         User      @relation(fields: [userId], references: [id])
  plan         String    // "free" | "pro" | "premium" | "team"
  status       String    // "active" | "cancelled" | "expired"
  startedAt    DateTime  @default(now())
  expiresAt    DateTime?
  tossSubKey   String?   // Toss 정기결제 키
  cancelledAt  DateTime?
}
```

### 12-2. 플랜별 권한 체크

`src/lib/plans.ts`
- canUseFeature(userId, feature): boolean
- 무료: 7일 통계, 룰 1개, 음성 메모 (크레딧)
- Pro: 무제한 통계, 룰, CSV Export, 텔레그램
- Premium: + AI 리포트, AI 채팅, 마일스톤
- Team: + 5명 멤버, 멘토 기능

각 페이지/API에서 권한 체크 미들웨어 적용.

### 12-3. 구독 결제 페이지

`src/app/pricing/page.tsx`
- 4개 플랜 카드
- 현재 플랜 표시
- 업그레이드 버튼

`src/app/api/subscriptions/create/route.ts`
- Toss 정기결제 시작
- 빌링키 발급

### 12-4. 무료 → 유료 전환 동기

각 기능에서 권한 부족 시 "Pro 업그레이드" 모달 표시.

---

## Phase 13 — Vercel 배포 준비

### 13-1. 환경 정리

- .env.example 파일 정리
- 모든 환경변수 문서화
- Vercel 환경변수 가이드 README 추가

### 13-2. 빌드 최적화

- Bundle 분석 (next-bundle-analyzer)
- 이미지 최적화 (next/image)
- 폰트 최적화 (next/font)
- ISR 설정

### 13-3. 모니터링 추가

- Sentry 연동 (에러 추적)
- Vercel Analytics
- Posthog (사용자 행동 분석, 옵션)

### 13-4. SEO

- metadata 설정
- OG 이미지
- sitemap.xml
- robots.txt

### 13-5. 배포

- Vercel 프로젝트 연결
- 도메인 연결
- 환경변수 설정
- DB는 Supabase 그대로 (포트 6543 Pooler)
- 배포 후 동작 확인

⚠️ 멈추고 사용자에게 물어봐야 함:
- 도메인 구매/연결 결정
- Vercel 계정 연결
- 프로덕션 환경변수 (실제 Toss live 키, 텔레그램 봇 등)

---

## 완료 후 다음 단계 (별도 작업)

- 베타 테스터 모집
- 피드백 반영
- 거래소 추가 (Binance, OKX, Bybit)
- 익명 통계 비교
- 백테스트 모드
- 팀/멘토 기능

---

**진행 시작하면 Phase 4부터 순서대로 자동 진행해줘.**
