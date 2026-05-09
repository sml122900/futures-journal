# 트러블슈팅: 결제 페이지 로그인 리다이렉트

**날짜**: 2026-05-10

---

## 문제 상황

로그인 상태에서 "충전하기" 버튼으로 `/payments` 진입 시 `/login`으로 튕김.

---

## 원인

```typescript
const { data: session } = useSession();
if (!session) { router.push("/login"); return null; }
```

`useSession()`은 초기값이 `null`이고 비동기로 세션을 가져옴.  
세션 로딩이 완료되기 전 `session === null`이 되어 즉시 리다이렉트.

---

## 최종 해결법

```typescript
const { data: session, status } = useSession();
if (status === "loading") return null;        // 로딩 중 대기
if (status === "unauthenticated") { router.push("/login"); return null; }
```

`status`로 세 상태(`loading` / `authenticated` / `unauthenticated`)를 구분.

---

## 이력서 소재

> NextAuth `useSession` 초기값 null로 인한 클라이언트 사이드 오인증 리다이렉트 진단, `status` 필드로 세션 로딩/인증/비인증 상태 분리
