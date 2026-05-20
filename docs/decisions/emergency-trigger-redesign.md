# 기술 결정: Emergency Brake 트리거 시스템 재설계

**날짜**: 2026-05-21

---

## 배경

기존 시스템은 `UserBaseline` 통계(평균/중간값 포지션 사이즈)와 비교해 `sizeMultiplier`가 임계값을 넘으면 발동했다. 문제:

1. **False positive 과다**: 과거 큰 매매 1~2건이 있으면 기준값이 올라가 실제 위험한 진입도 발동 안 됨
2. **사용자 예측 불가**: "왜 경고가 왔지?" — 자동 계산 기준이라 사용자가 예측 불가
3. **UserBaseline 의존**: `sampleSize < 5` 보호로 신규 사용자는 아예 작동 안 함

---

## 결정: 6개 사용자 정의 룰

| 트리거 | 체크 방식 |
|--------|-----------|
| `max_total_position` | 현재 모든 포지션 합 > 입력값 |
| `no_trade_window` | 현재 시각이 등록한 단발 금지 기간 안 |
| `recurring_no_trade` | 현재 KST 시각이 반복 금지 시간대 안 |
| `max_single_loss` | 포지션 중 손실 > 입력값 |
| `min_interval` | 마지막 진입으로부터 경과 시간 < 입력값 |
| `max_single_size` | 이번 진입 사이즈 > 입력값 |

**Level 결정**: 발동된 룰 개수 기준 (1=L1, 2=L2, 3+=L3)

---

## 이유

- **사용자 직접 정의** → 왜 발동됐는지 명확, false positive 구조적 제거
- **통계 불필요** → `UserBaseline` 없이도 신규 사용자 즉시 사용 가능
- **절대값 기준** → "1회 최대 100 USDT"처럼 직관적

---

## 포기한 대안

| 대안 | 포기 이유 |
|------|-----------|
| 기존 sizeMultiplier 방식 유지 | false positive 구조적으로 해결 불가 |
| AI 기반 동적 임계값 | API 비용 + 지연 + 불투명성 |
| 통계 + 사용자 룰 병행 | 복잡도만 증가, 사용자 혼란 |

---

## DB 변경 내역

- `EmergencySetting` 삭제 (enabled/threshold/activeHoursOnly 방식 폐기)
- `UserTriggerSettings` 추가 (6개 룰 값 + forceSentence + lastPositionEntryAt)
- `NoTradeWindow` 추가 (단발 금지 기간, startAt/endAt UTC)
- `RecurringNoTrade` 추가 (반복 금지 시간대, KST HH:MM)
- `TriggerViolation` 추가 (발동 이력)

---

## 주요 구현 세부

**시간대**: 모든 시간은 KST 기준 입력/표시, DB는 UTC 저장.  
`isInTimeRange()` 함수가 자정 넘어가는 범위(예: 23:00~06:00)를 처리.

**lastPositionEntryAt**: `UserTriggerSettings`에 저장. 새 포지션 감지 시 `updateLastPositionEntry()` 호출.

**다중 발동 통합**: 여러 룰 동시 발동 시 하나의 텔레그램/FCM 메시지에 모두 나열.
