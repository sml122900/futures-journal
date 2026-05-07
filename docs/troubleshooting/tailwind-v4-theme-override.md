# 트러블슈팅: Tailwind v4 화이트 모드 미적용

**날짜**: 2026-05-07

---

## 문제 상황
`html[data-theme="light"]` 선택자 안에서 Tailwind CSS 변수(`--color-gray-950` 등)를 오버라이드해도 화이트 모드가 전혀 적용되지 않음. 다크 모드와 완전히 동일하게 보임.

---

## 시도한 것들

| 시도 | 결과 |
|------|------|
| `html[data-theme="light"] { --color-gray-950: #f0f4f8; }` | 적용 안 됨 |
| `:root` 안에서 CSS 변수 오버라이드 | 적용 안 됨 |

---

## 원인
Tailwind v4는 유틸리티 클래스를 **빌드 시 값을 직접 삽입**하는 방식으로 컴파일함.

```css
/* Tailwind v3 방식 (CSS 변수 참조) */
.bg-gray-950 { background-color: var(--color-gray-950); }

/* Tailwind v4 방식 (값 직접 삽입) */
.bg-gray-950 { background-color: oklch(0.145 0.004 258.57); }
```

CSS 변수를 오버라이드해도 이미 컴파일된 `oklch()` 값은 바뀌지 않음.

## 최종 해결법
유틸리티 클래스를 **직접 오버라이드**:

```css
html[data-theme="light"] .bg-gray-950 { background-color: #f0f4f8; }
html[data-theme="light"] .bg-gray-900 { background-color: #ffffff; }
html[data-theme="light"] .text-white   { color: #0f172a; }
/* ... 전체 클래스 목록 */
```

추가로 솔리드 배경 위 흰 글씨(배지 등)는 `text-force-white` 커스텀 클래스 사용:
```css
.text-force-white { color: #ffffff !important; }
```

## 이력서 소재
> Tailwind v4의 CSS 변수 vs 직접값 컴파일 차이를 파악하고, 클래스 직접 오버라이드 방식으로 런타임 테마 전환 시스템을 구현
