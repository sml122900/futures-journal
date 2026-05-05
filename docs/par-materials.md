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
