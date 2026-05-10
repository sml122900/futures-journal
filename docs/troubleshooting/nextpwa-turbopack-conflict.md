# 트러블슈팅: next-pwa + Turbopack 충돌

**날짜**: 2026-05-11

---

## 문제 상황

`next-pwa`를 `next.config.ts`에 withPWA 래퍼로 적용 후 빌드 실패.

```
ERROR: This build is using Turbopack, with a `webpack` config and no `turbopack` config.
This may be a mistake.
As of Next.js 16 Turbopack is enabled by default and
custom webpack configurations may need to be migrated to Turbopack.
Build error occurred
Error: Call retries were exceeded
```

---

## 시도한 것들

| 시도 | 결과 |
|------|------|
| `turbopack: {}` 빈 설정 추가 | 동일 오류 (next-pwa가 여전히 webpack 주입) |
| `@ducanh2912/next-pwa` 대체 | 동일 문제 |
| `--webpack` 플래그로 Turbopack 비활성화 | 빌드 성공하나 개발 서버와 환경 불일치 |

---

## 원인

`next-pwa`는 내부적으로 `webpack()` 설정 함수를 통해 서비스 워커를 번들링함.  
Next.js 16부터 Turbopack이 기본값이고, Turbopack은 `webpack` 설정 객체를 무시하거나 충돌을 일으킴.

---

## 최종 해결법

`next-pwa` 완전 제거. 수동 Service Worker 방식으로 대체:

1. `public/sw.js` — Cache First 전략, API 라우트 제외
2. `public/manifest.json` — PWA 앱 메타데이터
3. `public/offline.html` — 오프라인 폴백
4. `layout.tsx` 인라인 스크립트 — `navigator.serviceWorker.register('/sw.js')`

`next.config.ts`는 `turbopack: {}`만 유지.

---

## 이력서 소재

> Next.js 16 Turbopack + next-pwa webpack 충돌 진단, 수동 Service Worker 방식으로 전환해 PWA 구현 완료
