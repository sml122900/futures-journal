# 기술 결정: next-pwa 미사용 → 수동 Service Worker

**날짜**: 2026-05-11

---

## 문제

PWA 구현을 위해 `next-pwa` 패키지를 설치했으나 `next.config.ts`에 적용 시 빌드 실패.

```
ERROR: This build is using Turbopack, with a `webpack` config and no `turbopack` config.
NOTE: your `webpack` config may have been added by a configuration plugin.
```

`next-pwa`가 내부적으로 webpack 플러그인을 주입하는데, Next.js 16부터 Turbopack이 기본값으로 변경되어 webpack 설정이 충돌.

---

## 결정: next-pwa 제거 + 수동 구현

### 선택한 이유

1. **호환성**: Turbopack과 완전 호환, 빌드 파이프라인 수정 불필요
2. **단순성**: 3개 파일(`sw.js`, `manifest.json`, `offline.html`)로 핵심 PWA 기능 구현 가능
3. **제어권**: 캐시 전략을 코드 레벨에서 직접 제어 (API 경로 캐시 제외 등)

### 구현 내용

- `public/manifest.json`: 앱 이름·아이콘·shortcuts·theme_color
- `public/sw.js`: install→precache, activate→구버전 정리, fetch→Cache First (API 제외)
- `public/offline.html`: 오프라인 폴백
- `layout.tsx` 인라인 스크립트: `navigator.serviceWorker.register('/sw.js')`

### 포기한 대안

- **next-pwa**: Turbopack 미지원 (Next.js 16+에서 사용 불가)
- **@ducanh2912/next-pwa**: 동일 문제
- **Turbopack 비활성화 (--webpack)**: Turbopack 성능 이점 포기, 마이그레이션 역행
