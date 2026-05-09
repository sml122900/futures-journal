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

### Bitget Hedge Mode fills 방향 식별 (2026-05-08)
- **Problem**: 롱+숏 동시 보유(hedge mode) 환경에서 리플레이 시 반대 포지션 체결이 혼입됨. `posSide`/`holdSide`/`positionId` 등 일반적인 식별 필드가 fills API 응답에 전혀 없음
- **Action**: 실제 API 응답 필드 목록 분석으로 `side` 필드가 주문 방향이 아닌 포지션 방향(buy=롱, sell=숏)임을 규명. `o.side === "buy"` 기준으로 롱·숏 완전 분리
- **Result**: hedge mode에서 롱/숏 포지션 리플레이 정확히 분리, 반대 포지션 체결 혼입 문제 해결
