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
