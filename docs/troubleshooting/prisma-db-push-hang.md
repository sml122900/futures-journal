# 트러블슈팅: prisma db push 무한 hang

**날짜**: 2026-05-07

---

## 문제 상황
`npx prisma db push` 실행 시 아래 메시지 이후 무응답. 에러 없이 영구 대기.

```
Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma
Datasource "db": PostgreSQL database "postgres", schema "public" at "...pooler.supabase.com:6543"
(이후 무응답)
```

Supabase 대시보드 상 모든 서비스(Database, Auth, Realtime 등) Healthy 상태.
TCP 포트 연결 테스트(`Test-NetConnection`)는 성공.

---

## 시도한 것들

| 시도 | 결과 |
|------|------|
| `directUrl` 추가 (포트 6543) | 동일 증상 |
| 포트 5432 ↔ 6543 전환 | 동일 증상 |
| `migrate dev` → `db push` 전환 | 동일 증상 |
| `DEBUG=prisma:*` 디버그 로그 확인 | Schema Engine 실행 직후 hang 확인 |
| `?pgbouncer=true` 파라미터 추가 | 동일 증상 (Query Engine 전용 옵션) |
| Direct Connection 시도 | "Not IPv4 compatible" — 무료 플랜 IPv6 전용 |

---

## 최종 해결법

**원인 3가지가 복합 작용:**

**① 비밀번호 특수문자 URL 인코딩 누락**
비밀번호의 `&`, `!`, `,`, `%`가 URL 구분자로 오인식되어 인증 실패 또는 hang 유발.
→ 퍼센트 인코딩 처리: `&`→`%26`, `!`→`%21`, `,`→`%2C`, `%`→`%25`

**② Transaction Pooler에서 Schema Engine hang**
포트 6543(Transaction Pooler)은 PgBouncer 트랜잭션 모드 → Schema Engine의 PostgreSQL 핸드셰이크 미지원.
`?pgbouncer=true`는 Query Engine 전용이므로 무관.
→ Schema Engine용 연결은 별도 `directUrl` 필요

**③ Direct Connection IPv4 미지원 (Supabase 무료 플랜)**
`db.xxx.supabase.co:5432` = IPv6 전용.
→ Session Pooler(포트 5432)로 대체. IPv4 호환 + DDL 지원.

**최종 설정:**
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // Transaction Pooler :6543 ?pgbouncer=true
  directUrl = env("DIRECT_URL")     // Session Pooler :5432
}
```

---

## 이력서 소재
> Prisma + Supabase 연동 시 Transaction Pooler의 Schema Engine 미지원, IPv4 Direct Connection 불가, 비밀번호 URL 인코딩 3가지 문제를 디버그 로그와 TCP 레벨 테스트로 독립적으로 진단하여 Session Pooler 이중 URL 구조로 해결
