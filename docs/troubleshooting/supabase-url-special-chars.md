# 트러블슈팅: Supabase 연결 문자열 특수문자 인코딩

**날짜**: 2026-05-05

---

## 문제 상황
`prisma db push` 실행 시 DB 연결에서 hang 또는 `P1000: Authentication failed` 오류 발생.

```
Datasource "db": PostgreSQL database "postgres" at "...pooler.supabase.com:6543"
(이후 무응답)
```

## 시도한 것들
1. `directUrl` 추가 (`DIRECT_URL` 환경변수) → 동일 증상
2. 포트 5432 ↔ 6543 전환 → 동일 증상
3. `prisma migrate dev` → `prisma db push`로 변경 → 동일 증상

## 최종 해결법
비밀번호에 URL 예약 문자가 포함되어 연결 문자열 파싱이 깨진 것이 원인.
비밀번호의 특수문자를 URL 인코딩 처리:

| 원본 | 인코딩 |
|------|--------|
| `&`  | `%26`  |
| `!`  | `%21`  |
| `,`  | `%2C`  |
| `%`  | `%25`  |

```env
# 잘못된 예 (특수문자 그대로)
DATABASE_URL="postgresql://user:p@ss&word!@host:6543/db"

# 올바른 예 (URL 인코딩)
DATABASE_URL="postgresql://user:p%40ss%26word%21@host:6543/db"
```

## 이력서 소재
> Supabase 연결 hang 원인을 비밀번호 URL 인코딩 누락으로 진단하고, 특수문자 4종을 퍼센트 인코딩 처리하여 해결
