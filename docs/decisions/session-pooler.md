# 기술 결정: Supabase Session Pooler (포트 5432) — DIRECT_URL

**날짜**: 2026-05-07

---

## Problem
Prisma Schema Engine(`db push`, `migrate`)은 DB에 직접 연결해 DDL(CREATE TABLE 등)을 실행해야 한다. 그런데 두 가지 제약이 겹쳤다.

1. **Transaction Pooler(포트 6543)**: Schema Engine이 PostgreSQL 핸드셰이크를 완료하지 못하고 무한 hang. `?pgbouncer=true`는 Query Engine 전용이라 Schema Engine에 무관.
2. **Direct Connection(`db.xxx.supabase.co:5432`)**: Supabase 무료 플랜은 Direct Connection이 IPv6 전용. IPv4 네트워크에서 연결 불가.

## Action
Supabase가 제공하는 **Session Pooler(포트 5432)**를 `DIRECT_URL`로 채택.

- Session Pooler는 클라이언트 세션 단위로 커넥션을 유지 → DDL 지원
- IPv4 호환 → 별도 애드온 없이 사용 가능
- `directUrl`로만 사용하므로 런타임(Vercel 서버리스)에는 영향 없음

최종 `.env` 구조:
```
DATABASE_URL → Transaction Pooler (6543) + ?pgbouncer=true  # 런타임
DIRECT_URL   → Session Pooler (5432)                        # 스키마 변경
```

## Result
- `prisma db push` 660ms 내 완료, 6개 테이블 Supabase에 생성 성공
- IPv4 환경 + 무료 플랜 제약 내에서 마이그레이션 가능한 구조 확립
- 런타임은 Transaction Pooler로 서버리스 커넥션 과부하 방지 유지
