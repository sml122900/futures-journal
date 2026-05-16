# 기술 결정: Emergency Brake 아키텍처

**날짜**: 2026-05-17

---

## 배경

뇌동매매 감지 시 텔레그램으로 30초~1분 동안 다단계 알림을 발송해야 함.
Vercel serverless 환경에서 타이머 기반 시퀀스를 어떻게 구현할지가 핵심 문제.

---

## 결정 1: DB 큐 방식 (EmergencyScheduledAlert)

**포기한 대안**: in-memory setTimeout
- Next.js API Route가 요청 처리 후 프로세스 종료 → setTimeout 소멸
- Vercel serverless에서 워커 프로세스 장기 유지 불가

**선택한 방식**: `EmergencyScheduledAlert` DB 테이블에 발송 예약 저장 + 매분 cron 처리기

```
포지션 진입 감지
  → EmergencyAlertSession 생성
  → step1 즉시 발송
  → step2~7을 scheduledAt 계산해 DB에 INSERT
  → 매분 cron: scheduledAt <= now AND status=pending 조회 → 발송
```

**이유**: Vercel 무료 플랜에서 신뢰 가능한 유일한 방법. cron 1분 해상도가 1초 간격 발송보다 거칠지만 수십 초 단위 시퀀스에는 충분.

---

## 결정 2: false positive 방지 — max(avg, median) 기준

**문제**: 평균 진입 사이즈만 기준으로 쓰면 과거에 고액 이상치가 있을 경우 기준이 올라가 실제 큰 진입도 트리거 안 됨.

**선택**: `referenceSize = Math.max(avgPositionSize, medianPositionSize)`

두 값 중 큰 쪽을 기준으로 → 이상치에 덜 민감한 median이 더 작을 경우 avg를 사용해 더 보수적인 기준 유지.

---

## 결정 3: 신규 포지션 구분 — 30초 임계값

**포기한 대안 A**: lastSeenPositions 캐시 (Redis)
- Vercel 무료 플랜에 Redis 없음

**포기한 대안 B**: DB에 lastSyncedAt 저장
- 추가 테이블 또는 필드 필요

**선택한 방식**: `Date.now() - openedAt < 30_000`
- 진입 후 30초 이내만 신규로 간주
- 단순, false positive 낮음, 5분 dedup과 이중 보호

---

## 포기한 대안 (전체)

| 대안 | 포기 이유 |
|------|-----------|
| setTimeout | serverless 프로세스 수명 문제 |
| Redis 큐 (BullMQ 등) | Vercel 무료 플랜 인프라 제약 |
| 단일 cron에서 순차 발송 | cron 실행 시간(1분) 안에 6개 메시지를 여러 사용자에게 발송 불가 |
| lastSeen DB 캐시 | 구조 복잡도 대비 효과 미미 (30초 임계값으로 충분) |
