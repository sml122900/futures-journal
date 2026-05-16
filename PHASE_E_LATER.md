# Phase E (Emergency Brake) — 보류 항목

> 기능 동작에는 문제 없지만 명세 대비 미구현이거나 향후 단계에서 처리할 항목.

---

## 🟢 E8 — 통계 섹션

**명세**: "이번 달 Emergency 발동 횟수 / 사용자 청산 비율 / 추정 손실 회피액 (-XX USDT)"

**현황**: `/settings/emergency` 페이지에 통계 섹션 없음.

**구현 방향**:
- `GET /api/settings/emergency` 응답에 집계 추가:
  ```typescript
  const stats = await prisma.emergencyAlertSession.aggregate({
    where: { userId, startedAt: { gte: startOfMonth } },
    _count: { _all: true }
  });
  const closedCount = await prisma.emergencyAlertSession.count({
    where: { userId, startedAt: { gte: startOfMonth }, userAction: "user_closing" }
  });
  ```
- 페이지에 섹션 추가: 발동 횟수, 청산 비율, (추정 손실 회피액은 positionId로 해당 포지션 손익 추적 필요)

---

## 🟢 E8 — Off/Mild/Standard/Aggressive 강도 선택 섹션

**명세**: 섹션 2에 4단계 강도 선택 버튼.

**현황**: 개별 level1/2/3 슬라이더로 대체됨. 버튼 UX 없음.

**구현 방향**: 프리셋 버튼 4개가 각 임계값을 일괄 설정하는 방식으로 구현.
```
Off:        level1=999, level2=999, level3=999 (사실상 비활성)
Mild:       level1=2.0, level2=3.0, level3=7.0
Standard:   level1=1.5, level2=2.0, level3=5.0  (기본값)
Aggressive: level1=1.2, level2=1.5, level3=3.0
```

---

## 🟢 customMessage — 크롬 확장 전용 (Phase E 텔레그램 범위 외)

**명세 원문**: "강제 문장 (선택) — 크롬 확장에서만 사용"

**현황**: DB 필드 + 설정 UI는 구현됨. 텔레그램 알림 템플릿에는 미반영.

**이유**: Phase E는 텔레그램 알림 전용. customMessage는 향후 크롬 확장(포지션 진입 시 브라우저 오버레이)에서 사용 예정.

**보류 처리**: 설정 UI에 "(크롬 확장 준비 중)" 안내 문구 추가 고려.

---

## 🟢 E3 — pastSimilarLossAvg 실제 손실률 계산

**현황**: `pastSimilarLossAvg` 항상 `undefined`. 과거 세션 건수(`pastSimilarCount`)만 제공.

**이유**: `EmergencyAlertSession.positionId`로 실제 손익 데이터를 조회하려면 거래소 API 재호출 또는 별도 손익 저장 테이블 필요.

**구현 방향**: `EmergencyAlertSession`에 `finalPnl Float?` 필드 추가 → emergency-queue cron이 포지션 종료 감지 시 저장 → `findSimilarPastPatterns`에서 집계.

---

## 🟢 E5 — step1 발송 실패 시 cron 재시도

**현황**: step1은 `startEmergencySequence` 내에서 즉시 발송. 실패 시 `EmergencyScheduledAlert` 레코드가 없어 cron 재시도 불가.

**구현 방향**: step1도 DB 예약 후 cron에서 발송하는 방식으로 변경. 단, 이 경우 1초 지연이 발생하므로 trade-off 존재.

---

## 작업 이력

| 날짜 | 내용 |
|------|------|
| 2026-05-16 | Phase E 구현 후 검증 → 보류 항목 분리 |
