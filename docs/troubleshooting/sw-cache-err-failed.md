# 트러블슈팅: Service Worker 캐시로 인한 ERR_FAILED

**날짜**: 2026-05-12

---

## 문제 상황

개발 중 몇 번 클릭하거나 페이지를 이동하면 브라우저에서 `ERR_FAILED` 발생.
PowerShell로 직접 요청하면 200 OK인데 브라우저에서만 실패.

---

## 원인

서비스 워커(`public/sw.js`)가 세 가지 문제를 동시에 가지고 있었음:

| 문제 | 증상 |
|------|------|
| PRECACHE에 `/`, `/dashboard` 포함 | 로그인 상태의 HTML을 캐시 → 로그아웃 후 stale 응답 제공 |
| `/_next/` 청크 캐시 | HMR이 새 JS 청크 생성 시 SW가 구버전 제공 → 스크립트 오류 → ERR_FAILED |
| Cache First 전략 | 네트워크보다 캐시를 먼저 확인 → 위 두 문제가 증폭 |

---

## 시도한 것들

1. `allowedDevOrigins` 추가 → HMR cross-origin 경고는 해결되었으나 ERR_FAILED 지속
2. 브라우저 캐시 삭제 → 일시적으로 해결되나 재발

---

## 최종 해결법

**`public/sw.js` 수정:**
```javascript
// 수정 전
const PRECACHE = ["/", "/dashboard", "/offline.html"];
// Cache First: 캐시 먼저 → 없으면 네트워크

// 수정 후
const CACHE = "fj-v2"; // 버전 올려서 기존 캐시 자동 폐기
const PRECACHE = ["/offline.html"]; // 인증 페이지 제외
// /_next/ 경로 fetch 핸들러에서 제외
// Network First: 네트워크 먼저 → 실패 시 캐시
```

**`layout.tsx` 수정:**
```typescript
// 개발 모드에서 기존 SW 자동 해제
if (process.env.NODE_ENV !== 'production') {
  navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
}
```

**`providers.tsx` 수정:**
```tsx
<SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
```
→ 탭 전환마다 `/api/auth/session` 연속 호출 차단

---

## 교훈

- 개발 중 Service Worker는 **반드시 비활성화**해야 함 — HMR과 충돌 필연적
- Cache First는 인증이 필요한 SPA에 위험 — 로그인 상태 캐시 후 로그아웃 시 stale HTML 제공
- `/_next/static/` 파일은 SW 캐시에서 제외 필수 (콘텐츠 해시로 CDN 캐시가 충분)

---

## 이력서 소재

> Service Worker Cache First 전략이 Next.js HMR·인증 상태 변화와 충돌해 ERR_FAILED 발생 — 캐시 범위 축소, Network First 전환, 개발 모드 SW 자동 해제로 해결
