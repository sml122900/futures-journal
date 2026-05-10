# 기술 결정: 플랜 기반 기능 권한 게이팅

**날짜**: 2026-05-11

---

## 배경

구독 시스템(Subscription 모델)을 추가했지만 실제 API에서 플랜 권한을 체크하지 않아
모든 사용자가 premium 기능(AI 코치, 리포트 등)을 무제한 사용 가능한 상태였음.

---

## 결정: checkFeatureAccess(userId, feature) + 403 PLAN_REQUIRED

### 구현 구조

```typescript
// src/lib/plans.ts
export async function checkFeatureAccess(userId: string, feature: Feature): Promise<boolean> {
  const sub = await prisma.subscription.findUnique({ where: { userId }, select: { plan: true } });
  const plan = (sub?.plan ?? "free") as Plan;
  return canUseFeature(plan, feature);
}

// API 라우트에서 사용
const allowed = await checkFeatureAccess(userId, "ai_coach");
if (!allowed) {
  return NextResponse.json(
    { success: false, message: "PLAN_REQUIRED", data: { required: "premium" } },
    { status: 403 }
  );
}
```

### 게이팅 적용 API

| API | 필요 플랜 | Feature 키 |
|-----|---------|-----------|
| `POST /api/ai/coach-chat` | premium | ai_coach |
| `POST /api/reports/weekly` | premium | ai_reports |
| `GET /api/export/excel` | pro | excel_export |
| `POST /api/rules` (2번째~) | pro | rules_unlimited |

### 클라이언트 처리

403 + `PLAN_REQUIRED` 응답 → `UpgradeModal` 표시
```typescript
if (res.status === 403 && json.message === "PLAN_REQUIRED") {
  setShowUpgradeModal({ required: json.data.required });
}
```

### 포기한 대안

- **미들웨어(middleware.ts)**: Next.js 미들웨어는 Edge Runtime으로 Prisma 직접 호출 불가
- **JWT claim에 plan 포함**: 플랜 변경 즉시 반영 불가, 재로그인 필요
