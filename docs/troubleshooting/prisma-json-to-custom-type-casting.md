# 트러블슈팅: Prisma Json 필드 ↔ 커스텀 TypeScript 타입 캐스팅

**날짜**: 2026-05-17

---

## 문제 상황 1: 저장 시 (커스텀 타입 → Prisma Json)

`EmergencyAlertSession.context` 필드(Prisma `Json`)에 `EmergencyContext` 객체를 저장할 때:

```
Type 'EmergencyContext' is not assignable to type 'JsonNull | InputJsonValue'.
Type 'EmergencyContext' is not assignable to type 'InputJsonObject'.
  Index signature for type 'string' is missing in type 'EmergencyContext'.
```

Prisma의 `InputJsonValue`는 index signature `[key: string]: unknown`을 요구하지만
커스텀 인터페이스에는 그게 없어 직접 할당 불가.

---

## 문제 상황 2: 조회 시 (Prisma Json → 커스텀 타입)

DB에서 읽은 `sess.context` (타입: `Prisma.JsonValue`)를 `EmergencyContext`로 쓸 때:

```
Conversion of type 'string | number | boolean | JsonObject | JsonArray | null'
to type 'Omit<EmergencyContext, ...>' may be a mistake because neither type
sufficiently overlaps with the other.
```

---

## 최종 해결법

**두 단계 캐스팅 패턴** (`as unknown as TargetType`):

저장:
```typescript
context: decision.context as unknown as import("@prisma/client").Prisma.InputJsonValue,
```

조회:
```typescript
const storedCtx = sess.context as unknown as Omit<EmergencyContext, "symbol" | "side" | "size" | "sessionId">;
const ctx: EmergencyContext = { symbol: sess.symbol, ...storedCtx };
```

---

## 교훈

- Prisma `Json` 필드는 런타임에는 JS 객체이지만 TypeScript 타입이 `JsonValue`로 고정됨
- 커스텀 타입과 직접 캐스팅 불가 → `as unknown as` 패턴이 표준 해결책
- 이미 `prisma/schema.prisma` 트러블슈팅 로그에 동일 패턴 기록됨 (2026-05-11)

---

## 이력서 소재

> Prisma Json 필드와 커스텀 TypeScript 인터페이스 간 타입 불일치 → `as unknown as` 이중 캐스팅으로 해결. 런타임 안전성 유지하면서 TypeScript 엄격 모드 통과.
