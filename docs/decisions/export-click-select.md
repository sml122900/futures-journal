# 기술 결정: 클릭으로 선택 범위 지정 내보내기

**날짜**: 2026-05-12

---

## 배경

내보내기 페이지에서 날짜를 직접 입력하는 방식 외에, 대시보드의 실제 내역을 보면서 시작·종료 행을 더블클릭으로 직접 지정하는 UX가 필요했음.

---

## 결정: sessionStorage + 고정 배너 + 더블클릭 핸들러

### 상태 전달: URL params 대신 sessionStorage

```typescript
// export 페이지 → dashboard
sessionStorage.setItem("fjExportSelect", JSON.stringify({ section: "positions" }));
router.push("/dashboard");

// dashboard 마운트 시
const raw = sessionStorage.getItem("fjExportSelect");
if (raw) {
  const { section } = JSON.parse(raw);
  setExportMode({ section, step: 0, startTs: null, endTs: null });
}
```

### 3단계 배너 (fixed, top-[52px])

| Step | 메시지 | 동작 |
|------|--------|------|
| 0 | 시작 시점을 더블클릭 하세요 | 행 더블클릭 → step 1 |
| 1 | 종료 시점을 더블클릭 하세요 | 행 더블클릭 → step 2 |
| 2 | 형식을 고르세요 | Excel / CSV 버튼 표시 |

### 행 하이라이트

```typescript
const exportRowCls = (rowTime: number) => {
  if (rowTime === exportMode.startTs) return 'bg-blue-500/20 outline outline-1 outline-blue-400';
  if (rowTime === exportMode.endTs)   return 'bg-amber-500/20 outline outline-1 outline-amber-400';
  // 범위 내: 연녹색
  if (rowTime > lo && rowTime < hi)  return 'bg-green-500/5';
};
```

### 포기한 대안

- **URL params (`?exportSelect=positions`)**: `useSearchParams`가 Suspense 필요 → 구조 복잡도 증가
- **React Context**: 전역 상태 추가보다 sessionStorage가 페이지 이동에 더 적합
- **단순 날짜 입력만**: UX 요청 사항이 "실제 내역을 보면서 선택" — 날짜 입력으로는 충족 불가
