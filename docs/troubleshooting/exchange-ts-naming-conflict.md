# 트러블슈팅: exchanges.ts와 exchanges/ 디렉토리 이름 충돌

**날짜**: 2026-05-12

---

## 문제 상황

거래소 추상화 레이어 구현을 위해 `src/lib/exchanges/` 디렉토리를 생성하고 `index.ts`를 작성했으나, 빌드 시 모든 `@/lib/exchanges` import가 기존 `exchanges.ts` 파일을 가리켜 새 디렉토리의 `index.ts`가 인식되지 않음.

빌드 에러:
```
Export createExchangeForUser was not found in module [project]/src/lib/exchanges.ts
Did you mean to import isValidExchange?
```

---

## 원인

Node.js 모듈 해석 순서: **파일 > 디렉토리 index**

`@/lib/exchanges` import는 다음 순서로 해석:
1. `src/lib/exchanges.ts` ← 존재하므로 여기서 멈춤
2. `src/lib/exchanges/index.ts` ← 1번이 있어서 확인 안 함

---

## 시도한 것들

1. `exchanges/index.ts`에 모든 export 추가 → 여전히 기존 `exchanges.ts` 참조됨
2. `@/lib/exchanges/index` 경로 명시적 사용 검토 → 일관성 저해, 모든 import 수정 필요

---

## 최종 해결법

기존 `exchanges.ts` → `exchange-meta.ts`로 파일 이름 변경.

```bash
cp src/lib/exchanges.ts src/lib/exchange-meta.ts
rm src/lib/exchanges.ts
```

기존 파일을 참조하던 UI 파일들 import 경로 업데이트:
- `@/lib/exchanges` → `@/lib/exchange-meta` (온보딩, 설정 페이지 등)

새 거래소 추상화 레이어는 `@/lib/exchanges` (→ `exchanges/index.ts`) 로 접근.

---

## 교훈

- 파일과 같은 이름의 디렉토리를 같은 위치에 만들면 Node.js 모듈 해석 충돌 발생
- 기능별로 파일명을 명확히 구분 (`exchange-meta.ts` = UI 메타데이터, `exchanges/` = API 추상화)

---

## 이력서 소재

> Node.js 모듈 해석 순서 충돌로 신규 디렉토리 index.ts가 인식 안 되는 빌드 실패 — 기존 파일명 변경으로 파일/디렉토리 충돌 해소
