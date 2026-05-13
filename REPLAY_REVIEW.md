# 매매 리플레이 · 백테스트 플레이어 점검 보고서

**점검일**: 2026-05-13  
**수정일**: 2026-05-14 — 🔴 × 1 + 🟡 × 7 수정 완료  
**점검 파일**: `src/app/replay/page.tsx`, `src/app/backtest/[id]/_components/BacktestPlayer.tsx`,  
`src/app/api/bitget/candles/route.ts`, `src/app/api/exchange/candles/route.ts`

---

## 항목별 ✅ / ⚠️ / ❌ 체크

### 핵심 기능

| 항목 | 리플레이 | 백테스트 | 비고 |
|---|---|---|---|
| LwC v5 API 사용 | ✅ | ✅ | `addSeries()`, `createSeriesMarkers()` 정상 |
| 캔들 데이터 자동 로딩 | ✅ | ✅ | |
| 1000봉 초과 자동 분할 | ✅ | ✅ | API 레이어에서 처리 |
| TF 선택 (1m~4H) | ✅ | ❌ | 리플레이: 7가지 / 백테스트: 5m 고정 |
| 1D 타임프레임 | ❌ | ❌ | API는 지원, 옵션 목록에 없음 |
| 진입 마커 | ✅ | ✅ | arrowUp/arrowDown |
| 청산 마커 | ✅ | ✅ | |
| 평단가 라인 (수수료 포함) | ✅ | ❌ | 리플레이만 구현됨 |
| 포지션 영역 음영 | ❌ | ❌ | 미구현 |
| PnL 실시간 표시 | ✅ | ✅ | |
| 거래량 히스토그램 | ✅ | ❌ | 리플레이만 구현됨 |

### 재생 컨트롤

| 항목 | 리플레이 | 백테스트 |
|---|---|---|
| 재생/일시정지 | ✅ | ✅ |
| 배속 (1×/2×/4×/8×) | ✅ | ✅ |
| 진행 슬라이더 (seek) | ✅ | ❌ |
| 처음으로 (⏮) | ✅ | ❌ |
| 끝으로 (⏭) | ❌ | ❌ |

### 사이드바

| 항목 | 리플레이 | 백테스트 |
|---|---|---|
| 체결/거래 내역 리스트 | ✅ | ✅ |
| 재생 위치 자동 스크롤 | ✅ | ❌ |
| 항목 클릭 → 해당 시점 점프 | ❌ | ❌ |
| 평단가·수량 정보 | ✅ | ✅ |

### UI/UX

| 항목 | 리플레이 | 백테스트 |
|---|---|---|
| 풀스크린 모드 | ❌ | ❌ |
| UTC 오프셋 조정 (-10~+13) | ✅ | ❌ (ko-KR 고정) |
| KRW 환산 | ❌ | ❌ |
| 다크/라이트 모드 대응 | ❌ | ❌ (하드코딩) |
| 모바일 반응형 | ❌ | ⚠️ |

### 데이터 처리

| 항목 | 리플레이 | 백테스트 |
|---|---|---|
| Hedge mode 필터 (side 매칭) | ✅ | N/A |
| Fills 범위 (±5분 여유) | ✅ | N/A |
| 캔들 범위 (±1시간 여유) | ✅ | N/A |
| 캔들 시간 정렬 | ✅ | ✅ |
| 중복 캔들 제거 | ✅ | ✅ |

### 차별화 기능

| 항목 | 상태 |
|---|---|
| 캔들 패턴 자동 인식 | ❌ |
| AI 코멘트 | ❌ |
| 비교 모드 | ❌ |
| 공유 링크 생성 | ❌ |
| GIF/MP4 내보내기 | ❌ |
| 스냅샷 저장 | ❌ |
| 리플레이 중 메모 작성 | ❌ |
| 진입가/청산가 가이드라인 | ⚠️ (Exit 라인만 있음) |
| 최대 손익 지점 마커 | ❌ |
| 청산가 라인 | ❌ |

### 신규 사용자 경험

| 항목 | 상태 |
|---|---|
| 첫 진입 튜토리얼 | ❌ |
| 샘플 리플레이 | ❌ |
| 빈 상태 메시지 | ⚠️ ("매매 내역 없음" 텍스트만 있음) |

---

## 1. 현재 구현 상태

### ✅ 잘 작동하는 기능 (리플레이)

- **LwC v5 API 완전 대응**: `addSeries(CandlestickSeries)`, `addSeries(HistogramSeries)`, `createSeriesMarkers` 등 v5 변경사항 반영 완료
- **캔들 자동 분할**: `maxSpan = 1000 * tfMs`로 구간 분할 후 `Promise.all` 병렬 패치
- **평단가 계산 (수수료 포함)**: `calcAvgEntry()` 함수에서 ENTRY/ADD 시 `price * size + |fee|` 가중평균, PARTIAL_CLOSE 시 평단가 유지, CLOSE 시 초기화 — Bitget 방식 그대로 재현
- **Unrealized + Realized + Total PnL 동시 표시**: 좌상단 오버레이에 4가지 지표 동시 노출
- **Hedge mode 필터**: `o.side === (side === "long" ? "buy" : "sell")` — Bitget의 side 필드(buy=롱방향)로 정확히 필터링
- **UTC 오프셋 localStorage 기억**: 세션 간 설정 유지
- **추천 타임프레임 자동 선택**: `recommendTf(duration)` — 2시간 이하 = 1m, 12시간 이하 = 5m 등
- **seek 슬라이더**: 드래그 시 해당 캔들까지의 전체 상태 즉시 재계산

### ✅ 잘 작동하는 기능 (백테스트)

- **Lookahead bias 방지**: 진입가 = `candles[revealed].open` (다음 캔들 시가), 마지막 캔들에서 진입 차단
- **SL/TP 자동 청산**: `checkAutoClose()` — `tradesRef + closingRef` 패턴으로 React strict mode 이중 실행 방지
- **진입/청산 마커**: 거래 시점 정확히 표시
- **실시간 시드 변화**: `currentSeed = initialSeed + totalPnl`
- **세션 통계 사이드바**: 총 거래, 완료, 승률, 순손익, 진행률

---

### ⚠️ 부분 구현된 기능

**리플레이 진행 슬라이더 우측 레이블**  
슬라이더 `max = candles.length`지만 우측 레이블은 `posTo`(포지션 종료 시각) 고정. 실제 캔들 마지막 시각(`candles[candles.length-1].time`)이 아니라 의미가 맞지 않음.

**리플레이 Exit 라인**  
`[...fills].reverse().find(f => f.type === "CLOSE" || f.type === "PARTIAL_CLOSE")`로 마지막 청산 fill 1개만 고정 표시. 부분청산이 여러 번 있을 경우 중간 청산 가격은 미표시.

**백테스트 사이드바 자동 스크롤**  
거래 목록이 `[...trades].reverse().map()`으로 역순 출력되어 최신 거래가 상단에 표시되지만, 새 거래 추가 시 자동 스크롤 없음.

**백테스트 차트 높이**  
`height: 400`으로 고정. 컨테이너는 `flex-1`이지만 차트 인스턴스는 픽셀 고정이라 큰 화면에서 차트 아래 빈 공간 발생.

---

### ❌ 아예 없는 기능

**리플레이**
- Fill 카드 클릭 → 해당 시점 seek 없음 (사이드바 항목에 `onClick` 없음)
- 끝으로 이동 (⏭) 버튼 없음
- 풀스크린 모드 없음
- 포지션 영역 음영(entry~current 구간 배경색) 없음
- 청산가 라인 없음

**백테스트**
- 진행 슬라이더 없음 — 특정 시점으로 점프 불가
- 처음으로 이동 버튼 없음
- 평단가 가격 라인 없음 (chart IPriceLine 미구현)
- 거래량 히스토그램 없음
- 타임프레임 선택 없음 (5m 하드코딩)

**공통**
- 풀스크린, KRW 환산, 다크/라이트 연동, 모바일 대응, 차별화 기능 전부 미구현

---

## 2. 발견된 버그

### 🔴 버그 1: 리플레이가 Bitget 전용 — Binance 사용자 사용 불가

```typescript
// replay/page.tsx:131
const fillRes = await fetch(`/api/bitget/orders?startTime=...`).then(r => r.json());
// replay/page.tsx:181
const candleRes = await fetch(`/api/bitget/candles?symbol=${sym}&tf=${newTf}&...`).then(r => r.json());
```

`/api/bitget/candles`는 내부에서 `getDecryptedCredentials(userId)`로 Bitget API 키를 요구.  
Binance 전용 사용자는 "API 키 필요" 400 에러. 대시보드는 이미 `/api/exchange/*` 통합 라우트로 이전됐지만 리플레이만 이전 안 됨.

**영향**: Binance 사용자 리플레이 전혀 불가.

---

### 🟡 버그 2: 리플레이 사이드바 자동 스크롤 조건 오작동

```typescript
// replay/page.tsx:365
useEffect(() => {
  ...
  const lastActive = sidebarRef.current.querySelector('[data-active="true"]');
  if (lastActive) lastActive.scrollIntoView(...);
}, [activeFillIds.size]); // ← Set의 size 변화에만 반응
```

같은 시각에 2개 fill이 체결되면 `activeFillIds.size`가 1번에 2씩 증가할 수 있어 중간 상태를 놓칠 수 있음. 또한 마지막 active fill ID가 바뀌어도 size가 같으면 스크롤 미발생.

---

### 🟡 버그 3: 백테스트 차트 height 고정

```typescript
// BacktestPlayer.tsx:104
const chart = createChart(chartRef.current, {
  ...
  height: 400,  // 픽셀 고정
});
```

`chartRef.current`의 실제 높이 대신 400px 고정. `ResizeObserver`는 width만 처리하고 height는 무시. 화면이 크거나 작을 때 레이아웃 불일치.

---

### 🟡 버그 4: 리플레이 `fetchData` 의존성 누락

```typescript
// replay/page.tsx:191
useEffect(() => { fetchData(tf); }, [tf]); // eslint-disable-line react-hooks/exhaustive-deps
```

`fetchData`가 deps에서 제외됨. `sym`, `from`, `to`, `side` URL 파라미터가 변경되어도 `tf`가 변경되지 않으면 데이터 재로드 안 됨. 일반적으로 URL 파라미터는 페이지 마운트 시 고정이지만, Suspense 내부에서 params가 지연 로드되는 경우 초기 `sym=""`으로 fetchData가 한 번 실행될 수 있음.

---

### 🟢 잠재적 문제: 백테스트 타임프레임과 기간 불일치

```typescript
// BacktestPlayer.tsx:79
const cRes = await fetch(`/api/exchange/candles?symbol=${s.symbol}&tf=5m&from=${s.startTime}&to=${s.endTime}&exchange=${exchange}`);
```

백테스트 기간이 한 달이면 5m 캔들은 약 8,640개. `BitgetExchange.getCandles()`는 1000봉 청크로 자동 분할하므로 9번 API 호출 발생 — 느리지만 오류는 아님. 기간이 매우 길면 로딩 시간이 길어짐.

---

## 3. 우선순위 추천

### 🔴 즉시 수정 (사용자 가치 직결 + 버그)

1. ✅ **리플레이 Binance 지원**: `/api/exchange/orders?exchange=${exch}`, `/api/exchange/candles?exchange=${exch}` 로 교체. Binance fill 필터에 `o.posSide === side` 조건 추가. `localStorage.getItem("fj_exchange")` 로 거래소 결정.

2. ✅ **Fill 카드 클릭 → seek**: FillCard에 `onSeek` prop 추가. 클릭 시 해당 fill 시각에 가장 가까운 캔들 인덱스로 seek. hover + keyboard 접근성 포함.

3. ✅ **백테스트 seek 슬라이더**: `handleSeek()` 추가. 후방 이동 시 해당 시점 이후 가상 거래 삭제 확인 모달.

### 🟡 출시 전 권장

4. ✅ **백테스트 평단가 라인**: `avgLineRef` + `IPriceLine` 추가. trades 변화 시 useEffect로 동적 업데이트.

5. ✅ **백테스트 TF 선택**: `tf` state + `BT_TF_OPTIONS` 추가. TF 변경 시 캔들 재로드 (`[sessionId, tf]` deps).

6. ✅ **백테스트 차트 height 동적화**: `chartRef.current.clientHeight || 400`. ResizeObserver에 height 갱신 포함.

7. ✅ **⏮ ⏩ 버튼**: handleReset (처음으로, 거래 삭제 확인), handleSkipEnd (끝으로) 추가.

8. ✅ **리플레이 사이드바 스크롤 조건 수정**: `lastActiveFillId` 변수로 dep 교체. 동시각 복수 fill도 정확히 감지.

9. ✅ **1D 타임프레임 추가**: 리플레이 `TF_OPTIONS`, 백테스트 `BT_TF_OPTIONS` 모두에 `"1D"` 추가.

### 🟢 출시 후 점진적 추가

10. **포지션 영역 음영**: LwC의 `createPriceBand()` 또는 복수 price line으로 진입~청산 구간 표시.

11. **청산가 라인**: 포지션 오픈 상태에서 청산 위험 가시화.

12. **최대 이익/손실 지점 마커**: fill 간 candle에서 max high/low 찾아 별도 마커로 표시.

13. **풀스크린 모드**: `document.documentElement.requestFullscreen()` 래핑.

14. **모바일 대응**: 사이드바를 하단 drawer로 전환 (768px 이하).

15. **다크/라이트 모드 연동**: LwC `applyOptions()` + `useEffect(() => { chart.applyOptions(themeConfig) }, [theme])`.

---

## 4. 영상화 강화 아이디어

### 매매 분석 도구 관점

**청산가 + MMR 실시간 시각화**  
포지션 오픈 중 청산가를 수평선으로 표시하고, 가격이 청산가에 근접할수록 붉은 음영 강도 증가. 레버리지 변경 시 청산가 자동 재계산.

**최대 손익 구간 하이라이트**  
재생 완료 후 "최대 이익 구간" (고점)과 "최대 손실 구간" (저점)에 별도 마커 + 텍스트. "이 시점에 청산했다면 +37 USDT" 식 사후 분석.

**진입 시점 RSI/이동평균 오버레이**  
진입 시점 캔들 주변에 14일 RSI, 200 EMA를 얇은 선으로 표시. "이 RSI에서 진입했습니다" 컨텍스트 제공.

**재생 중 리마인더 팝업**  
포지션 진행 중 특정 이벤트 시점(손절 -3%, 30분 경과 등)에 "이 시점에 어떤 판단을 했나요?" 팝업 트리거.

---

### 공유 · 마케팅 관점

**스냅샷 이미지 저장**  
`html2canvas` 또는 LwC의 `takeScreenshot()` API로 차트 영역을 PNG로 저장. "이번 트레이드 공유" 버튼 추가.

**공유 링크**  
현재 URL params(`sym, side, from, to, posId`)를 그대로 공유 가능한 구조는 이미 완성됨. 상단 바에 "링크 복사" 버튼 1개만 추가하면 됨.

**SNS 카드 이미지**  
OG 이미지 API (`/api/og/replay?...`) — puppeteer/satori로 차트 스냅샷 + PnL 카드 렌더링. Twitter/Discord 공유 시 미리보기 이미지 자동 생성.

---

### 학습 도구 관점

**재생 중 메모 작성**  
재생 일시정지 시 하단에 "이 시점 메모" 입력창 표시. 기존 MemoModal 연계하거나 별도 경량 입력. 나중에 해당 캔들 시각과 함께 메모 저장.

**백테스트 결과 vs 실거래 오버레이**  
백테스트 결과 페이지(`/backtest/[id]/result`)에서 같은 기간 실거래 PnL을 겹쳐 표시하는 차트 이미 명세에 있음(S3-8). 완성되면 "만약 이 전략을 실거래에 썼다면" 시각화 가능.

**시나리오 A/B 비교**  
같은 포지션에서 SL을 다르게 설정했을 때 결과 비교. 백테스트 세션 2개를 나란히 렌더링.

**"다시 해보기" 모드**  
리플레이 중 특정 시점에서 "여기서 청산했다면?" 가상 청산가 입력 → 실제 PnL과 비교. 의사결정 훈련.

---

## 현황 요약

| 영역 | 완성도 |
|---|---|
| 리플레이 기본 재생 | 약 70% |
| 리플레이 인터랙션 (클릭 seek 등) | 약 40% |
| 백테스트 기본 재생 | 약 65% |
| 백테스트 차트 디테일 | 약 35% |
| 캔들 API (Bitget) | 약 90% |
| 캔들 API (Binance/통합) | 약 70% |
| 차별화 기능 | 약 5% |
| 모바일/공유/내보내기 | 0% |

가장 빠른 사용자 가치 향상 순서:  
`Fill 클릭 seek` → `백테스트 seek 슬라이더` → `Binance 지원` → `백테스트 평단가 라인` → `청산가 라인`
