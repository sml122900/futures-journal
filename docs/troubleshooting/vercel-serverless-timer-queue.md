# 트러블슈팅: Vercel serverless에서 타이머 기반 시퀀스 구현

**날짜**: 2026-05-17

---

## 문제 상황

텔레그램 다단계 알림 시퀀스(1초 → 4초 → 10초 → 20초 → 35초 → 60초 → 5분)를
Vercel 환경에서 구현해야 함.

자연스러운 접근: `setTimeout`으로 각 step 예약

```typescript
// 이렇게 하면 안 됨
setTimeout(() => sendTelegramMessage(...), 4000);
setTimeout(() => sendTelegramMessage(...), 10000);
```

---

## 원인

Vercel serverless 함수는 HTTP 요청 처리 완료 후 프로세스가 종료됨.
setTimeout 콜백은 실행되지 않고 소멸. 심지어 무료 플랜은 실행 시간 10초 제한.

---

## 시도한 것들

1. `setTimeout` → 프로세스 종료 후 소멸. 불가.
2. Background jobs (Vercel Cron + await) → Cron 최소 단위 1분. 초 단위 시퀀스 불가.
3. Redis + BullMQ → Vercel 무료 플랜에 Redis 없음. 유료 서비스 추가 필요.

---

## 최종 해결법

**DB 큐 패턴**: `EmergencyScheduledAlert` 테이블에 발송 예정 시각을 저장 + 매분 cron이 처리.

```typescript
// 1. 시퀀스 시작 시
for (const step of sequence.slice(1)) {
  await prisma.emergencyScheduledAlert.create({
    data: {
      sessionId: session.id,
      step: step.step,
      scheduledAt: new Date(Date.now() + step.delayMs),
      status: "pending",
    },
  });
}

// 2. cron (매분 실행)
const dueAlerts = await prisma.emergencyScheduledAlert.findMany({
  where: { status: "pending", scheduledAt: { lte: new Date() } },
});
// 각 alert 발송
```

trade-off: 1분 cron 해상도 때문에 4초/10초 간격이 실제로는 최대 60초 지연 가능.
그러나 "1분 안에 6개 메시지"가 아닌 "1~5분에 걸쳐 6개 메시지" 방식으로도 경고 효과 충분.

---

## 교훈

- Vercel serverless에서 장시간 타이머는 불가 → DB 큐 패턴이 표준 해결책
- 1분 cron 해상도를 설계에 반영 (수십 초 단위 시퀀스 → 분 단위로 완화)
- 향후 Vercel Pro나 외부 큐(Inngest, QStash 등) 도입 시 초 단위 시퀀스 가능

---

## 이력서 소재

> Vercel serverless 환경에서 setTimeout 타이머 방식 불가 → Prisma DB 큐 + 매분 cron 패턴으로 텔레그램 다단계 알림 시퀀스 구현. 프로세스 수명 제약을 아키텍처 레벨에서 우회.
