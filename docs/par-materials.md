# 이력서 소재 모음 (PAR 형식)

> PAR = Problem → Action → Result

---

## 템플릿

### [기능/작업명]
- **Problem**: 어떤 문제 또는 과제가 있었나?
- **Action**: 어떻게 해결했나? (기술적 선택, 구현 방법)
- **Result**: 결과는? (정량 지표, 개선 효과)

---

## 소재 목록

### Supabase 연결 디버깅 (2026-05-05)
- **Problem**: `prisma db push` 실행 시 DB 연결이 무응답 상태로 hang되어 원인 불명 상태
- **Action**: 연결 문자열 파싱 구조를 분석해 비밀번호 내 특수문자(`&`, `!`, `,`, `%`)가 URL 구분자로 오인식됨을 진단, 퍼센트 인코딩 적용
- **Result**: 연결 문제 해결, 추후 동일 문제 발생 시 재현 가능한 트러블슈팅 가이드로 문서화

### Prisma + Supabase Session Pooler 연동 (2026-05-05)
- **Problem**: Vercel 서버리스 환경에서 DB 직접 연결 시 커넥션 한도 초과 위험, `prisma migrate dev`가 Session Pooler에서 미지원
- **Action**: Supabase Session Pooler(포트 6543)를 `DATABASE_URL`로 채택, 스키마 변경은 `prisma db push`로 대체
- **Result**: 서버리스 환경에 적합한 DB 연결 구조 확립, datasource 설정 단순화

### 다크/라이트 테마 시스템 구현 (2026-05-07)
- **Problem**: Tailwind v4에서 CSS 변수 오버라이드로 런타임 테마 전환 시도 시 전혀 적용되지 않음
- **Action**: v4가 CSS 변수가 아닌 컴파일된 값을 직접 사용한다는 것을 파악, 유틸리티 클래스 직접 오버라이드 방식으로 전환. 화면 깜빡임 방지를 위해 `<head>` 인라인 스크립트로 JS 실행 전 테마 적용
- **Result**: 다크/라이트/시스템 3가지 테마 전환 구현, localStorage 저장으로 새로고침 후에도 유지

### Bitget API 다중 엔드포인트 호환 파싱 (2026-05-07)
- **Problem**: `/api/v2/mix/order/fills` 응답 필드명이 주문 이력 엔드포인트와 달라 체결가·손익·수수료 전부 미표시
- **Action**: 두 엔드포인트의 필드명 차이 분석, fallback 체인(`o.price || o.priceAvg`)과 feeDetail 객체 순회로 양쪽 호환 파싱 함수 구현
- **Result**: 엔드포인트 무관하게 데이터 정상 표시, 유지보수성 향상

### HTML 프로토타입 → Next.js 풀스택 포팅 (2026-05-07)
- **Problem**: 단일 HTML 파일 프로토타입을 인증·DB·API 보안이 갖춰진 프로덕션 앱으로 전환 필요
- **Action**: NextAuth 인증, Prisma DB, 서버 API 라우트를 갖춘 Next.js App Router 구조로 전체 기능 포팅, 메모를 localStorage → DB 저장으로 전환
- **Result**: 로그인/회원가입, API 키 암호화, 거래 데이터 조회, 메모, 테마 전환 등 전체 기능 구현 완료

### 매매 리플레이(영상화) 기능 구현 (2026-05-08)
- **Problem**: 포지션별 매매 내역을 차트 위에서 영상처럼 재생해 매매 복기를 시각화하고 싶음
- **Action**: TradingView Lightweight Charts v5로 캔들 애니메이션 재생 엔진 구현. 배속·타임라인·TF 선택·사이드바 체결 내역·Avg Entry 점선·미실현/실현 PnL 실시간 계산까지 포함. 캔들 API(1000봉 자동 분할)와 리플레이 페이지를 Next.js App Router로 통합
- **Result**: 포지션 클릭 한 번으로 차트 위에서 매매 과정을 영상으로 복기 가능, UTC 오프셋 설정으로 시간대 정확도 확보

### 크레딧 기반 AI SaaS 수익화 설계 (2026-05-10)
- **Problem**: AI API 비용이 발생하는 기능에서 수익화 구조 필요. 사용자 직접 키 등록 허용 시 기술 허들 낮은 타겟(비트겟 API 연동 사용자) 특성상 수익화 불가.
- **Action**: 사용자 키 등록 옵션 완전 제거. 크레딧 충전 구매 방식으로 설계. 모델별 실제 API 비용 분석 후 마진 70~86% 확보하는 차감량 설정. Prisma transaction으로 결제 승인·크레딧 지급·로그 기록 원자적 처리.
- **Result**: 4개 패키지(1,000~20,000원) + 5개 AI 모델 선택 구조. 가입 보너스 30 크레딧으로 서비스 체험 가능.

### Toss Payments 결제 연동 (2026-05-10)
- **Problem**: `@tosspayments/payment-widget-sdk` 결제위젯 사용 시 401 Unauthorized 에러. 결제 UI 렌더링 전 버튼 클릭 시 "결제 UI가 아직 렌더링되지 않았습니다" 에러.
- **Action**: 위젯 SDK가 Toss 대시보드 별도 상품 활성화를 요구하는 제품임을 파악. `@tosspayments/payment-sdk` 일반 결제창으로 교체. React Strict Mode 이중 실행 방지, `useSession` status 기반 인증 처리 적용.
- **Result**: Toss 결제창 연동 완료. 카드 결제 → `/payments/success` 리다이렉트 → 크레딧 자동 지급 플로우 동작.

### 음성 메모 + AI 필드 자동 분류 (2026-05-10)
- **Problem**: 거래 직후 흥분 상태에서 텍스트로 메모하기 어려움. 5개 필드를 직접 분류·입력하는 과정이 번거로워 실사용률 저하 우려.
- **Action**: 브라우저 Web Speech API(무료, 실시간, 서버 불필요)로 STT 구현. 음성 원문 + 포지션 컨텍스트를 선택한 AI(Claude/Gemini)에 전달, 5개 메모 필드로 자동 분류. 크레딧 확인→AI 호출→차감을 Prisma transaction으로 처리.
- **Result**: 말하는 것만으로 진입이유·청산이유·심리상태 등 자동 분류. 모델별 차감량 차등 적용(5~50c).

### SaaS 기능 완성도 Gap Analysis 및 체계적 보완 (2026-05-11)
- **Problem**: Phase 4~12를 "완료"로 표시했으나 실제로는 PLAN.md 명시 요구사항의 30~60%만 구현된 상태. 누락 항목 파악 없이 커밋함
- **Action**: Phase별 파일 존재·로직 구현·동작 여부를 3단계로 검증. 8개 Phase에서 총 20개 이상 누락 항목 발견. SSE 스트리밍·플랜 게이팅·PNG 아이콘·Excel 시트 등 우선순위 순으로 보완
- **Result**: 모든 Phase ✅ 완료. 자동화 검증 스크립트(Node.js grep 41개 파일 + 40개 로직 패턴) 작성으로 재검증 효율화

### Claude API SSE 스트리밍 채팅 구현 (2026-05-11)
- **Problem**: AI 코치 채팅이 응답을 한 번에 반환해 3~10초 블로킹 발생. Next.js 서버리스에서 WebSocket 사용 어려움
- **Action**: Anthropic SDK `messages.stream()` + Next.js `ReadableStream` 조합으로 SSE 구현. 스트리밍 완료(done 이벤트) 후 트랜잭션으로 크레딧 차감·DB 저장 처리
- **Result**: 첫 글자 즉시 표시, 크레딧 안전 보장, 클라이언트 `getReader()` SSE 파싱으로 실시간 텍스트 렌더링

### 플랜 기반 API 권한 게이팅 설계 (2026-05-11)
- **Problem**: 구독 모델 추가 후 실제 API에 권한 체크가 없어 모든 사용자가 premium 기능 무제한 사용 가능
- **Action**: `checkFeatureAccess(userId, feature)` async 함수 구현 (DB 조회). reports/coach-chat/excel-export/rules 4개 API에 403 + PLAN_REQUIRED 응답 적용. 클라이언트 `UpgradeModal` 컴포넌트 연결
- **Result**: 플랜별 기능 분리 완성. Next.js 미들웨어(Edge Runtime) 대신 API Route 레이어 적용으로 Prisma 호환성 확보

### 룰 기반 리스크 감지 시스템 설계 (2026-05-11)
- **Problem**: API read-only 환경에서 매매 룰 위반을 막을 수 없고, 사용자가 룰을 어겼는지 사후에야 인지하는 문제
- **Action**: 6종 룰 타입(time_block/cooldown/daily_limit/psych_block/liq_distance/loss_streak) 정의. 포지션 조회 API 호출 시 백그라운드에서 `checkAllPositions` 실행, `@@unique([ruleId, positionId])`로 중복 위반 방지
- **Result**: 포지션 진입 시 자동 위반 감지 + DB 기록, 대시보드에 실시간 위험도 표시

### Next.js 16 Turbopack 환경 PWA 구현 (2026-05-11)
- **Problem**: `next-pwa`가 webpack 플러그인 기반으로 동작해 Next.js 16 Turbopack과 충돌, 빌드 실패
- **Action**: `next-pwa` 제거. `public/sw.js`(Cache First, API 제외), `manifest.json`, `offline.html` 직접 작성. layout.tsx 인라인 스크립트로 SW 등록
- **Result**: 의존성 0개 추가로 PWA 완성, Turbopack 호환, 캐시 전략 코드 레벨 직접 제어

### 풀스택 SaaS MVP 14개 기능 단일 세션 완성 (2026-05-11)
- **Problem**: 리스크 룰 UI / AI 리포트 / 데이터 Export / PWA / 마일스톤 / AI 코치 / 구독 시스템 등 대형 기능 9개를 체계적으로 구현 필요
- **Action**: PLAN.md 기반 Phase별 자동 진행. 각 Phase 완료 후 `npm run build`로 타입·빌드 검증, 실패 시 즉시 수정 후 재빌드하는 사이클 유지
- **Result**: Phase 4~12 연속 완료, 빌드 오류 0개로 마무리 (타입 오류 4건 즉시 수정)

### Bitget 원본 형식 호환 내보내기 + 메모 결합 (2026-05-12)
- **Problem**: 거래소 웹사이트 다운로드는 메모·심리상태 등 저널 데이터가 없고, 앱 내보내기는 Bitget 형식과 달라 기존 분석 워크플로 연계 불가
- **Action**: Bitget XLS 파일에서 실제 컬럼 구조 역공학 분석. 포지션 내역(12컬럼) + 매매 내역(13컬럼) 각각 동일 형식으로 구현. positionId 기반 메모 JOIN으로 진입이유·청산이유·심리상태 4개 컬럼 추가. 90일 청크 분할 + idLessThan 커서로 기간 무제한 조회
- **Result**: Excel/CSV 모두 지원, Bitget 원본과 동일한 컬럼 순서·형식 유지하면서 매매 심리 데이터 포함

### 더블클릭 범위 선택 UX 구현 (2026-05-12)
- **Problem**: 내보내기에서 날짜 입력은 실제 내역을 보지 않고 날짜를 외워야 해서 번거로움. "3번째 포지션부터 7번째까지" 같은 직관적 선택 불가
- **Action**: sessionStorage로 선택 모드 상태를 페이지 간 전달. 대시보드에 고정 배너(fixed, z-50)로 3단계 안내(시작→종료→형식). 더블클릭된 행을 색상 강조(파란/주황/녹색), 선택 완료 시 즉시 다운로드 후 모드 자동 해제
- **Result**: 내역을 눈으로 보면서 범위 지정 → 클릭 4회로 다운로드 완료. URL params/Context 없이 sessionStorage만으로 페이지 간 UI 상태 전달

### PWA Service Worker 캐시 전략 오진단 수정 (2026-05-12)
- **Problem**: 개발 중 몇 번 클릭하면 ERR_FAILED 반복 발생. PowerShell 직접 요청은 200 OK — 서버 문제가 아님
- **Action**: 서비스 워커 로그 분석으로 /_next/ 청크 캐시가 HMR 신규 청크와 충돌임을 규명. PRECACHE의 /dashboard가 인증 HTML을 캐시해 stale auth 유발도 확인. /_next/ 전면 제외, Cache First → Network First 전환, 개발 모드 자동 SW 해제 3가지 동시 수정
- **Result**: ERR_FAILED 재현 없음. 개발/프로덕션 SW 동작 분리로 향후 동일 문제 예방

### 다중 거래소 추상화 레이어 설계 (2026-05-12)
- **Problem**: Bitget에 직접 결합된 1,000줄+ 대시보드 컴포넌트를 파서 변경 없이 Binance까지 지원해야 함
- **Action**: BaseExchange abstract class + BitgetExchange/BinanceExchange 구현체 + factory 패턴. 추상화 레이어에서 Bitget 호환 필드명으로 정규화해 DashboardContent 파서를 그대로 재사용
- **Result**: Binance 연동 완료. DashboardContent 파서 코드 변경 0줄. 신규 거래소 추가 시 Exchange 클래스 1개 + factory 1줄만 추가하면 됨

### Binance HEDGE/ONE-WAY 모드 포지션 방향 파악 (2026-05-12)
- **Problem**: Binance income API(REALIZED_PNL)에는 포지션 방향 없음. 무조건 "long"으로 하드코딩하면 숏 포지션 데이터 오표시
- **Action**: income 항목과 userTrades를 `tradeId` 우선 매칭, 실패 시 ±5초 + non-zero realizedPnl 조건으로 fallback 매칭. 매칭된 trade의 positionSide(LONG/SHORT/BOTH) + side(BUY/SELL)로 HEDGE/ONE-WAY 모드 모두 처리
- **Result**: unit test PASS. BTCUSDT HEDGE LONG→"long", ETHUSDT ONE-WAY BUY→"short" 정확히 판별

### 백테스트 Lookahead Bias 방지 설계 (2026-05-12)
- **Problem**: 캔들 재생 중 진입 버튼을 누르면 현재 캔들의 close 가격으로 진입 → 이미 알고 있는 가격 사용(lookahead bias)
- **Action**: 진입가 = `candles[revealed].open` (다음 캔들 시가). 마지막 캔들에서는 진입 버튼 disabled + "다음 캔들이 없어 진입 불가" 안내. 진입 모달에 "다음 캔들 시가로 체결" 명시
- **Result**: 현재 close와 다른 가격으로 체결되어 lookahead bias 제거. 마지막 캔들 엣지케이스까지 차단

### React setState 순수성 위반 수정 (2026-05-12)
- **Problem**: SL/TP 자동 청산 로직이 `setTrades(prev => { fetch(...) })` 패턴 — React Strict Mode에서 updater 2번 실행되어 API 2번 호출
- **Action**: `tradesRef`(최신 상태 ref)와 `closingRef`(처리 중 id Set)로 분리. setState updater는 순수 상태 계산만, fetch는 updater 완전 바깥에서 실행
- **Result**: dev/production 모두 1회 실행 보장, 중복 청산 방지, React 원칙 준수

### 텔레그램 봇 알림 시스템 구축 (2026-05-14)
- **Problem**: 룰 위반, 큰 손실, 청산 위험 등 중요 이벤트를 사용자가 앱을 열지 않으면 인지하지 못함. 실시간 알림 채널 부재
- **Action**: 텔레그램 Bot API 연동. 6자리 코드 연동 방식(10분 만료), 6종 알림 함수(try/catch + 1시간 dedup), MarkdownV2 `esc()` 헬퍼로 특수문자 자동 이스케이프. 6개 핵심 이벤트(룰위반/큰손실/청산위험/메모리마인더/주간리포트/마일스톤)에 non-blocking 통합
- **Result**: Prisma 스키마 1개 추가, API 5개, cron 1개, UI 설정 페이지. 알림 실패가 서버 오류로 전파되지 않는 구조

### Telegram MarkdownV2 파서 혼용 버그 수정 (2026-05-14)
- **Problem**: webhook 메시지에 MarkdownV2 이스케이프(`\\!` `\\.`)를 사용했지만 `parseMode: "Markdown"` v1으로 발송 → 텔레그램에서 백슬래시가 그대로 렌더링됨
- **Action**: `"MarkdownV2"` 타입 추가, 전체 sendTelegramMessage 기본값 통일. `notification-templates.ts`에 `esc()` 헬퍼(`String(v).replace(/[_*\[\]()~\`>#+\-=|{}.!]/g, "\\$&")`) 구축. 6개 템플릿 정적 텍스트 수동 이스케이프 + 동적 값(심볼·가격·퍼센트) 자동 이스케이프
- **Result**: 모든 텔레그램 메시지 정상 렌더링, parseMode 일관성 확보

### 멀티 거래소 리플레이 Binance 지원 (2026-05-14)
- **Problem**: 거래소 추상화 레이어(`/api/exchange/*`) 구축 후에도 리플레이 페이지가 `/api/bitget/*` 직접 호출 — Binance 사용자 400 에러로 사용 불가. 추가로 Binance fill 방향 필드명이 Bitget(`o.side: "buy"|"sell"`)과 다름(`o.posSide: "long"|"short"`)
- **Action**: `localStorage.getItem("fj_exchange")`로 활성 거래소 결정 → `/api/exchange/*?exchange=${exch}` 통합 라우트로 교체. fill 필터에 `|| oPosSide === side` 조건 추가로 양쪽 필드명 동시 지원
- **Result**: Binance 사용자 리플레이 정상 동작, Bitget 기존 동작 유지, 추후 거래소 추가 시 코드 변경 없음

### 백테스트 인터랙션 개선 — seek + TF 선택 + 평단가 라인 (2026-05-14)
- **Problem**: 백테스트 플레이어에 진행 슬라이더·TF 선택·평단가 라인 없어 실전 차트 도구 대비 조작성 열위. 차트 높이 400px 픽셀 고정으로 대형 화면 레이아웃 깨짐
- **Action**: seek 슬라이더 + ⏮⏩ 버튼 추가 (후방 seek 시 미래 거래 삭제 확인 모달). `tf` state + `BT_TF_OPTIONS` + `[sessionId, tf]` deps로 TF 변경 시 캔들 재로드. `IPriceLine` + `avgLineRef` + trades useEffect로 평단가 동적 라인. `ResizeObserver`에 height 갱신 추가
- **Result**: 백테스트 인터랙션 대폭 향상. lookahead bias 방지 로직(기존 구현) 유지하면서 seek 구현

### Bitget Hedge Mode fills 방향 식별 (2026-05-08)
- **Problem**: 롱+숏 동시 보유(hedge mode) 환경에서 리플레이 시 반대 포지션 체결이 혼입됨. `posSide`/`holdSide`/`positionId` 등 일반적인 식별 필드가 fills API 응답에 전혀 없음
- **Action**: 실제 API 응답 필드 목록 분석으로 `side` 필드가 주문 방향이 아닌 포지션 방향(buy=롱, sell=숏)임을 규명. `o.side === "buy"` 기준으로 롱·숏 완전 분리
- **Result**: hedge mode에서 롱/숏 포지션 리플레이 정확히 분리, 반대 포지션 체결 혼입 문제 해결

### Supabase RLS 전체 테이블 활성화 (2026-05-14)
- **Problem**: Supabase Security Advisor가 public 스키마 전체 테이블의 RLS 미활성화 경고 발행. 프로젝트가 `db push` 방식으로 운영 중이라 migration history가 없어 `prisma migrate deploy`로 적용 불가
- **Action**: `prisma db execute --file migration.sql`로 18개 테이블 `ENABLE ROW LEVEL SECURITY` 직접 실행. 정책(Policy)은 미추가 — Prisma service role 연결은 RLS를 우회하므로 기존 기능 무영향
- **Result**: Supabase Security Advisor 경고 해소, anon/authenticated 역할의 직접 테이블 접근 차단. 앱 기능 전혀 변화 없음

### Emergency Brake — 뇌동매매 감지 다단계 텔레그램 알림 시스템 (2026-05-17)
- **Problem**: 충동 매매 감지 후 1회 알림만으로는 사용자가 무시하는 경우가 많음. 30초~5분에 걸쳐 6개 메시지를 연속 발송하는 시퀀스가 필요했으나, Vercel serverless 환경에서 setTimeout은 프로세스 종료와 함께 소멸
- **Action**: DB 큐 패턴 설계 — `EmergencyScheduledAlert` 테이블에 각 step의 `scheduledAt`을 저장, 매분 cron이 due 알림을 조회해 발송. 포지션 청산 감지 시 자동 취소, Step7에서 실시간 PnL 조회 후 동적 메시지 생성
- **Result**: Vercel 무료 플랜에서 7단계 알림 시퀀스 구현. 사용자의 청산 버튼 클릭 → 즉각 후속 취소 + 칭찬 메시지 플로우 완성

### UserBaseline 통계 기반 false positive 최소화 (2026-05-17)
- **Problem**: 단순히 "평소보다 2배 크면 경고" 로직은 거래량이 들쑥날쑥한 트레이더에게 false positive가 많음. 특히 과거에 고액 거래가 한 번이라도 있으면 avg가 올라가 실제 이상 진입을 감지 못함
- **Action**: 최근 30일 종료 포지션을 `getClosedPositions(limit:200)`으로 수집, `max(avgPositionSize, medianPositionSize)` 기준값 사용. sampleSize < 5이면 미발동. riskyHours/riskyDaysOfWeek는 "3건 이상 + 손실률 60%+"인 경우에만 리스키로 분류
- **Result**: false positive 최소화. 신규 사용자 보호(5건 미만) + 이상치 내성(median 기준) + 행동 패턴 기반 위험 시간대 감지

### Vercel Hobby 플랜 Cron 제약 우회 (2026-05-19)
- **Problem**: emergency-queue(매 5분 필요)를 vercel.json에 등록했으나 Hobby 플랜 하루 1회 제한으로 배포 오류. `*/5 * * * *`도 거부됨
- **Action**: vercel.json에서 해당 항목 제거. `/api/cron/emergency-queue` 라우트는 그대로 유지하고 외부 스케줄러(cron-job.org 무료)에서 HTTP GET으로 직접 호출하는 구조로 이관
- **Result**: 코드 변경 0줄로 스케줄러 교체 완료. 배포 오류 해소, 5분 간격 외부 트리거로 동일 동작 유지

### Vercel 배포 환경 점검 체계화 (2026-05-19)
- **Problem**: Vercel 배포 전 .env 노출 여부, prisma generate 누락, NEXTAUTH_URL 플레이스홀더 등 다수 항목 점검 필요. 놓치면 배포 후 런타임 오류 또는 보안 노출
- **Action**: 점검 항목 체계화 — git ls-files/log/status 3단계 .env 검사, `prisma generate && next build` 스크립트 통합, 환경변수 13개 변경 필요 여부 분류표 작성, CRON_SECRET/NEXTAUTH_SECRET 신규 생성
- **Result**: 배포 전 보안 이슈 0건, 빌드 성공(77페이지), 환경변수 목록 완비

### Emergency Brake 인라인 버튼 callback 처리 (2026-05-17)
- **Problem**: 텔레그램 인라인 버튼 클릭(callback_query) 처리가 기존 webhook에 없었음. 청산 버튼 클릭 시 후속 알림 6개를 즉시 취소해야 하는 트랜잭션적 요구사항
- **Action**: webhook/route.ts에 `callback_query` 분기 추가. `emergency_close_` 클릭 시 DB에서 해당 세션의 pending 알림 전체 updateMany(cancelled), `answerCallbackQuery`로 즉각 팝업 응답. `emergency_keep_` 클릭 시 userAction 기록 후 후속 유지
- **Result**: 버튼 클릭 즉시 피드백 + 세션 상태 정확히 추적. Telegram 10초 내 answerCallbackQuery 미호출 시 "loading..." 표시 버그 방지
