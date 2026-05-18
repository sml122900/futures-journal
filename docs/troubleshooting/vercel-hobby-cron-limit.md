# 트러블슈팅: Vercel Hobby 플랜 Cron 실행 빈도 제한

**날짜**: 2026-05-19

---

## 문제 상황

`vercel.json`에 등록된 `emergency-queue` cron 스케줄:

```json
{ "path": "/api/cron/emergency-queue", "schedule": "* * * * *" }
```

Vercel 배포 시 다음 오류 발생:

> Cron jobs on the Hobby plan are limited to once per day.

매분(`* * * * *`) → 매 5분(`*/5 * * * *`)으로 완화해도 동일 오류.

---

## 원인

Vercel Hobby 플랜은 cron 실행 빈도를 **하루 1회**로 제한.
`*/5 * * * *` (하루 288회)는 여전히 초과.

---

## 시도한 것들

1. `* * * * *` (매분) → 오류
2. `*/5 * * * *` (매 5분) → 오류
3. `0 0 * * *` (매일 자정) → 가능하지만 Emergency 알림 큐 처리용으로는 24시간 지연이 무의미

---

## 최종 해결법

**vercel.json에서 emergency-queue 항목 자체 제거.**

```json
// 제거 전
{ "path": "/api/cron/emergency-queue", "schedule": "*/5 * * * *" }

// 제거 후 → 항목 없음
```

대신 **외부 무료 스케줄러**로 대체:
- [cron-job.org](https://cron-job.org) 무료 플랜: 매 5분 간격 가능, HTTP GET 요청
- 설정: `GET https://[배포도메인]/api/cron/emergency-queue?secret=CRON_SECRET` 매 5분

`/api/cron/emergency-queue` 라우트는 그대로 유지 — Vercel cron이 아닌 외부에서 호출.

---

## 교훈

- Vercel Hobby 플랜 cron 제약: **하루 1회** 한도
- 분 단위 cron이 필요한 기능은 외부 스케줄러(cron-job.org, Upstash QStash) 필요
- `*/N * * * *` 형태는 모두 Hobby 플랜에서 거부됨
- 하루 1회 이하(daily/weekly/monthly)만 vercel.json에 등록 가능

---

## 이력서 소재

> Vercel Hobby 플랜 cron 하루 1회 제한 → emergency-queue(매 5분 필요)를 vercel.json에서 제거, 외부 cron-job.org로 이관. API 라우트는 그대로 유지해 스케줄러 교체에 코드 변경 없음.
