# 트러블슈팅: Telegram Markdown v1 + MarkdownV2 문법 혼용

**날짜**: 2026-05-14

---

## 문제 상황

텔레그램 봇 연동 완료 메시지에 백슬래시가 그대로 표시됨:

```
✅ 연동 완료\!

Futures Journal 계정과 연동됐습니다\.
```

Webhook 핸들러와 test/route.ts에 `\\!` `\\.` `\\-` 이스케이프가 이미 작성되어 있었는데, 실제 텔레그램에서 이스케이프가 해석되지 않고 문자 그대로 출력됨.

---

## 원인

```typescript
// webhook/route.ts — 연동 완료 메시지
`✅ *연동 완료\\!*\n\n계정과 연동됐습니다\\.`

await sendTelegramMessage(chatId, text, { parseMode: "Markdown" }); // ← v1
```

- `\\!` `\\.` `\\-` 는 **MarkdownV2** 문법 (특수문자 앞에 `\` 필요)
- 하지만 `parseMode: "Markdown"` 은 **Markdown v1** 파서 사용
- Markdown v1은 `.` `!` `-` 를 이스케이프 없이 사용 가능 → `\\.` = 백슬래시 + 마침표 리터럴로 렌더링

Telegram의 두 파서 차이:
| 파서 | 이스케이프 필요 문자 |
|------|-----|
| Markdown v1 | `*` `_` `` ` `` `[` 만 |
| MarkdownV2 | `_ * [ ] ( ) ~ \` > # + - = \| { } . !` 전부 |

---

## 시도한 것들

1. `\\!` `\\.` 제거 (v1 방식으로 맞추기) → 다른 메시지들도 전부 수정 필요, 일관성 깨짐
2. `parseMode: "MarkdownV2"` 변경 → 타입 에러 (`"MarkdownV2"` 가 타입에 없었음)

---

## 최종 해결법

**MarkdownV2로 완전 통일:**

1. `telegram.ts` 타입에 `"MarkdownV2"` 추가:
```typescript
parseMode?: "Markdown" | "MarkdownV2" | "HTML";
```

2. `telegram.ts` 기본값 변경:
```typescript
parse_mode: options?.parseMode ?? "MarkdownV2",
```

3. `notifications.ts` 전체 `parseMode: "Markdown"` → `"MarkdownV2"` 교체 (6개)

4. `notification-templates.ts` 에 `esc()` 헬퍼 추가 — 동적 값(심볼, 가격 등)에 적용:
```typescript
function esc(v: string | number): string {
  return String(v).replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}
```

5. 6개 템플릿 전면 재작성 — 정적 문자 수동 이스케이프, 동적 값은 `esc()` 감싸기

6. `webhook/route.ts` 모든 메시지 MarkdownV2 정합성 검증

---

## 교훈

- 텔레그램 봇 개발 시 Markdown v1 / MarkdownV2 중 하나를 초기에 확정할 것
- MarkdownV2가 더 엄격하지만 안전 — 한 번 `esc()` 헬퍼 구축하면 이후 템플릿 추가 용이
- `MarkdownV2`는 `.` `!` `(` `)` `-` `+` `|` 등 일상 텍스트에도 이스케이프 필요 → 자동 이스케이프 없이 직접 작성하면 반드시 누락 발생

---

## 이력서 소재

> 텔레그램 봇 Markdown v1/v2 파서 혼용으로 백슬래시 렌더링 버그 — MarkdownV2 단일 표준화 + 동적 값 자동 이스케이프 헬퍼로 해결
