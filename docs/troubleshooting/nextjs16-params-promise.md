# 트러블슈팅: Next.js 16 동적 라우트 params Promise 타입 오류

**날짜**: 2026-05-11

---

## 문제 상황

`/api/rules/[id]/route.ts` 빌드 시 타입 오류 발생.

```
Type '(req: NextRequest, { params }: { params: { id: string; }; }) => ...'
is not assignable to type
'(request: NextRequest, context: { params: Promise<{ id: string; }>; }) => ...'

Types of property 'params' are incompatible.
Property 'id' is missing in type 'Promise<{ id: string; }>'
but required in type '{ id: string; }'.
```

---

## 원인

Next.js 15부터 동적 라우트 핸들러의 `params`가 동기 객체에서 **`Promise<{...}>`로 변경**.  
Next.js 16에서도 동일하게 적용됨.

기존 패턴 (Next.js 14):
```typescript
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params; // 동기
}
```

---

## 최종 해결법

```typescript
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { id } = await params; // Promise await 필요
}
```

Page 컴포넌트에서도 동일:
```typescript
type RouteContext = { params: Promise<{ id: string }> };

export default async function Page({ params }: RouteContext) {
  const { id } = await params;
}
```

---

## 이력서 소재

> Next.js 15→16 동적 라우트 params 비동기화 마이그레이션 진단 및 수정 (`RouteContext` 타입 정의 패턴 도입)
