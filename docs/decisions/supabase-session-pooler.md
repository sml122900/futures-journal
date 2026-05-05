# 기술 결정: Supabase Session Pooler (포트 6543)

**날짜**: 2026-05-05

---

## Problem
Vercel 서버리스 환경에서 PostgreSQL 직접 연결(Direct Connection)을 사용하면 함수 호출마다 새 DB 커넥션이 생성된다. 동시 요청이 몰릴 경우 DB 커넥션 한도를 초과할 수 있다.

## Action
Supabase가 제공하는 **Session Pooler(포트 6543)**를 `DATABASE_URL`로 사용. 커넥션 풀러가 중간에서 연결을 재사용하므로 서버리스 환경에서 안정적이다.

`prisma migrate dev`는 Session Pooler에서 DDL을 지원하지 않으므로 스키마 변경 시 `prisma db push`를 사용한다.

## Result
- 서버리스 환경에서 커넥션 누수 없이 DB 연결 안정화
- `prisma/schema.prisma`의 datasource를 단일 `url`만으로 단순하게 유지
- 스키마 변경 명령어: `npx prisma db push`
