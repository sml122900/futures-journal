# 트러블슈팅: Lightweight Charts v5 API 변경

**날짜**: 2026-05-08

---

## 문제 상황
`chart.addCandlestickSeries()`, `chart.addHistogramSeries()`, `series.setMarkers()` 호출 시 TypeScript 오류 및 런타임 오류 발생.

---

## 원인
Lightweight Charts v4 → v5에서 API 대폭 변경.

| v4 | v5 |
|----|----|
| `chart.addCandlestickSeries(opts)` | `chart.addSeries(CandlestickSeries, opts)` |
| `chart.addHistogramSeries(opts)` | `chart.addSeries(HistogramSeries, opts)` |
| `series.setMarkers(markers)` | `createSeriesMarkers(series, markers)` 반환값의 `.setMarkers()` |

---

## 최종 해결법
```typescript
import { CandlestickSeries, HistogramSeries, createSeriesMarkers } from "lightweight-charts";

const candleSeries = chart.addSeries(CandlestickSeries, { ... });
const volumeSeries = chart.addSeries(HistogramSeries, { ... });
const markers = createSeriesMarkers(candleSeries, []);
markers.setMarkers([...]);
```

---

## 이력서 소재
> Lightweight Charts v5 마이그레이션에서 addSeries/createSeriesMarkers 등 API 변경 대응, 타입 오류 없이 TradingView OSS 차트 통합 완료
