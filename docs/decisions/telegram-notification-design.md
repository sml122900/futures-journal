# 기술 결정: 텔레그램 알림 시스템 설계

**날짜**: 2026-05-14

---

## 배경

사용자가 룰 위반, 큰 손실, 청산 위험 등 중요 이벤트 발생 시 앱을 열지 않아도 알림을 받을 수 있어야 함.
텔레그램 Bot API를 선택한 이유: 한국 트레이더 텔레그램 사용률 높음, API 무료, 인라인 버튼 지원.

---

## 결정 1: 연동 코드 방식 (6자리 코드 + 10분 만료)

**포기한 대안**: OAuth 콜백 방식
- `setWebhook` → bot.getMe() → 사용자가 `/start` 클릭 → chatId 자동 저장
- 문제: OAuth 플로우 구현 복잡도 높음, 봇 "Start" 버튼만으로는 userId 매핑 불가

**선택한 방식**: 연동 코드
1. 앱에서 6자리 코드 생성 (DB 저장, 10분 만료)
2. 사용자가 봇에 `/link CODE` 전송
3. webhook이 코드 검증 → chatId 저장 → 연동 완료

**이유**: 단순, 보안 충분 (10분 만료), 봇과의 상호작용이 자연스러움. `NotificationSetting.linkCode` + `linkCodeExpiresAt` 필드로 완전 처리.

---

## 결정 2: MarkdownV2 단일 표준

**포기한 대안**: Markdown v1 유지
- v1은 `.` `!` `-` 이스케이프 불필요 — 단순한 메시지에 유리
- 하지만 기존 코드에 `\\!` `\\.` `\\-` 가 이미 작성됨 (v2 문법)
- v1 + v2 문법 혼용 = 백슬래시 그대로 렌더링 버그 발생 (실제로 발생)

**선택한 방식**: MarkdownV2 통일 + `esc()` 헬퍼
```typescript
function esc(v: string | number): string {
  return String(v).replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}
```
동적 값(심볼, 가격 등)에 자동 이스케이프 적용. 정적 텍스트는 수동 이스케이프.

**이유**: 한 번 `esc()` 구축하면 이후 템플릿 추가가 안전. 인라인 버튼도 MarkdownV2에서 안정적.

---

## 결정 3: 알림 발송 실패가 앱에 영향을 미치지 않는 구조

모든 notify 함수를 non-blocking으로 호출:
```typescript
notifyRuleViolation(userId, rule, pos).catch(() => {});
```

각 함수 내부도 try/catch로 감싸 `throw` 없음. 텔레그램 API 다운, rate limit 초과, chatId 만료 등 모든 케이스에서 메인 비즈니스 로직(룰 위반 기록, 마일스톤 달성 등)에 영향 없음.

---

## 결정 4: 메모 리마인더 = "어제 메모 없는 사용자"

**포기한 방법**: "메모 없는 종료 포지션 감지"
- 포지션 내역은 DB에 없고 거래소 API에만 존재 → cron에서 exchange API 호출 시 API 키 노출 + rate limit 위험

**선택한 방법**: "어제 KST 날짜에 저장된 실질 메모(내용 있는 것)가 없는 사용자"
- Memo DB만 조회, 거래소 API 호출 불필요
- 완벽하지 않지만 (거래가 없는 날도 알림 가능) 사용자가 memoReminder를 ON한 경우에만 발송

---

## 포기한 대안

| 대안 | 포기 이유 |
|------|-----------|
| 이메일 알림 | SMTP 설정, deliverability, 응답 속도 모두 텔레그램 대비 열위 |
| Web Push | iOS 제한, ServiceWorker 복잡도, VAPID 키 관리 |
| Slack 봇 | 개인 트레이더 대상 서비스에 Slack은 과잉 |
