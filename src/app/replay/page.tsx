'use client';
import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  createChart, IChartApi, ISeriesApi, IPriceLine,
  CandlestickSeries, HistogramSeries,
  CandlestickData, HistogramData, Time, LineWidth,
  createSeriesMarkers, ISeriesMarkersPluginApi,
} from "lightweight-charts";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Candle { time: number; open: number; high: number; low: number; close: number; volume: number; }
interface Fill {
  id: string; time: number; isBuy: boolean; label: string; price: number;
  size: number; type: 'ENTRY' | 'ADD' | 'PARTIAL_CLOSE' | 'CLOSE'; fee: number;
  cumulativeSize: number;
}

const TF_OPTIONS = ["1m", "3m", "5m", "15m", "30m", "1H", "4H", "1D"] as const;
const SPEED_MS: Record<number, number> = { 1: 200, 2: 100, 4: 50, 8: 25 };


function recommendTf(durationMs: number): string {
  const h = durationMs / 3_600_000;
  if (h <= 2) return "1m";
  if (h <= 12) return "5m";
  if (h <= 72) return "15m";
  if (h <= 336) return "1H";
  return "4H";
}

// utcOffset: hours offset from UTC (e.g. +9 for KST)
function fmtTime(ms: number, utcOffset = 0) {
  if (!ms) return "-";
  const adjusted = ms + utcOffset * 3_600_000;
  const d = new Date(adjusted);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${mi}`;
}
function fmtPrice(n: number) {
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1) return n.toFixed(2);
  if (abs >= 0.01) return n.toFixed(4);
  if (abs >= 0.0001) return n.toFixed(6);
  return n.toFixed(8);
}
function fmtPnl(n: number) { return (n >= 0 ? "+" : "") + n.toFixed(2); }
function pnlColor(n: number) { return n > 0 ? "#4ade80" : n < 0 ? "#f87171" : "#9ca3af"; }

// ── Fill card ─────────────────────────────────────────────────────────────────

function FillCard({ fill, active, future, utcOffset, onSeek }: {
  fill: Fill; active: boolean; future: boolean; utcOffset: number; onSeek: () => void;
}) {
  const isBuy = fill.isBuy;
  return (
    <div
      onClick={onSeek}
      role="button" tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onSeek(); }}
      className={`px-3 py-2.5 border-b border-gray-800 transition-colors text-xs cursor-pointer ${
        active ? "bg-gray-700/60" : future ? "opacity-30 hover:opacity-50" : "hover:bg-gray-800/50"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold" style={{ color: isBuy ? "#4ade80" : "#f87171" }}>
          {fill.label}
        </span>
        <span className="text-gray-500">{fmtTime(fill.time, utcOffset)}</span>
      </div>
      <div className="flex justify-between text-gray-400">
        <span>{isBuy ? "▲" : "▼"} {fmtPrice(fill.price)}</span>
        <span className="text-gray-500">size: {fill.size}</span>
      </div>
      <div className="flex justify-between mt-0.5 text-gray-600">
        <span>Held: {fill.cumulativeSize.toFixed(4)}</span>
        <span>Fee: {Math.abs(fill.fee).toFixed(4)}</span>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

function ReplayInner() {
  const params = useSearchParams();
  const router = useRouter();

  const sym   = params.get("sym") ?? "";
  const side  = params.get("side") ?? "long";
  const from  = parseInt(params.get("from") ?? "0");
  const to    = parseInt(params.get("to") ?? "0");
  const label = params.get("label") ?? sym;
  const posId = params.get("posId") ?? "";

  // 활성 거래소 — localStorage에서 읽어 고정 (리플레이 중 변경 없음)
  const [exchange] = useState<string>(() =>
    typeof window !== "undefined" ? (localStorage.getItem("fj_exchange") ?? "bitget") : "bitget"
  );

  const [tf, setTf] = useState(() => recommendTf(Math.max(to - from, 3_600_000)));
  const [candles, setCandles] = useState<Candle[]>([]);
  const [fills, setFills] = useState<Fill[]>([]);
  const [posFrom, setPosFrom] = useState(from);
  const [posTo, setPosTo] = useState(to);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [utcOffset, setUtcOffset] = useState<number>(0);
  useEffect(() => {
    const saved = localStorage.getItem("fj_replay_utc");
    if (saved !== null) setUtcOffset(Number(saved));
  }, []);

  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const intervalRef = useRef<ReturnType<typeof globalThis.setInterval> | null>(null);
  const idxRef = useRef(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const avgLineRef  = useRef<IPriceLine | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async (newTf: string, exch: string) => {
    if (!sym) return;
    setLoading(true); setError("");

    try {
      // fills: 포지션 시작 5분 전 ~ 종료 5분 후 (인접 포지션 혼입 최소화)
      const fillStart = from - 5 * 60_000;
      const fillEnd   = to   + 5 * 60_000;
      const fillRes = await fetch(
        `/api/exchange/orders?startTime=${fillStart}&endTime=${fillEnd}&limit=200&exchange=${exch}`
      ).then(r => r.json());
      const rawOrders: Record<string, unknown>[] =
        fillRes.data?.data?.fillList ?? fillRes.data?.data?.fills ?? [];
      const cleanSym = sym.replace("_UMCBL","").replace("_USDT-FUTURES","").toUpperCase();
      const dirLabel = side === "long" ? "Long" : "Short";
      let cumSize = 0;
      const parsedFills: Fill[] = rawOrders
        .filter(o => {
          const symMatch = (o.symbol as string || "").replace("_UMCBL","").replace("_USDT-FUTURES","").toUpperCase() === cleanSym;
          if (!symMatch) return false;
          // Bitget: o.side = "buy"(롱) / "sell"(숏) 포지션 방향
          // Binance: o.posSide = "long" / "short" 포지션 방향
          const oSide    = (o.side    as string || "").toLowerCase();
          const oPosSide = (o.posSide as string || "").toLowerCase();
          return oSide === (side === "long" ? "buy" : "sell") || oPosSide === side;
        })
        .sort((a, b) => parseInt(a.cTime as string || "0") - parseInt(b.cTime as string || "0"))
        .map((o, i) => {
          const tradeSide = (o.tradeSide as string || "").toLowerCase();
          const price  = parseFloat(o.price as string || o.priceAvg as string || "0");
          const size   = parseFloat(o.baseVolume as string || o.size as string || "0");
          const fee    = parseFloat(o.fee as string || "0");
          const t      = parseInt(o.cTime as string || o.ctime as string || "0");

          const isOpen = tradeSide === "open";
          const isBuy  = isOpen;
          const label  = isOpen ? `Open ${dirLabel}` : `Close ${dirLabel}`;
          let type: Fill["type"];
          if (isOpen) { type = cumSize === 0 ? "ENTRY" : "ADD"; cumSize += size; }
          else        { type = cumSize - size > 0.0001 ? "PARTIAL_CLOSE" : "CLOSE"; cumSize = Math.max(0, cumSize - size); }
          return { id: o.tradeId as string || o.orderId as string || `f${i}`, time: t, isBuy, label, price, size, fee, type, cumulativeSize: cumSize };
        });
      setFills(parsedFills);

      const firstFill = parsedFills[0];
      const lastFill  = parsedFills[parsedFills.length - 1];
      const actualFrom = firstFill?.time || from;
      const actualTo   = lastFill?.time  || to;
      setPosFrom(actualFrom);
      setPosTo(actualTo);

      const prepad  = 60 * 60_000;
      const postpad = 60 * 60_000;

      const candleRes = await fetch(
        `/api/exchange/candles?symbol=${sym}&tf=${newTf}&from=${actualFrom - prepad}&to=${actualTo + postpad}&exchange=${exch}`
      ).then(r => r.json());
      if (!candleRes.success) throw new Error(candleRes.message);
      setCandles(candleRes.candles ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "데이터 로드 실패");
    } finally {
      setLoading(false);
    }
  }, [sym, from, to, side]);

  useEffect(() => { fetchData(tf, exchange); }, [fetchData, tf, exchange]);

  // ── Chart init ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: { background: { color: "#111827" }, textColor: "#9ca3af" },
      grid: { vertLines: { color: "#1f2937" }, horzLines: { color: "#1f2937" } },
      timeScale: { timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: "#374151" },
      localization: {
        timeFormatter: (unixSec: number) => fmtTime(unixSec * 1000, utcOffset),
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#4ade80", downColor: "#f87171",
      borderUpColor: "#4ade80", borderDownColor: "#f87171",
      wickUpColor: "#4ade80", wickDownColor: "#f87171",
    });
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: "#26a69a", priceFormat: { type: "volume" }, priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });

    // Exit 라인 (고정)
    const exitFill = [...fills].reverse().find(f => f.type === "CLOSE" || f.type === "PARTIAL_CLOSE");
    if (exitFill) candleSeries.createPriceLine({ price: exitFill.price, color: "#a78bfa", lineWidth: 1 as LineWidth, lineStyle: 2, title: "Exit" });
    // Avg Entry 라인 (재생 중 동적으로 업데이트)
    avgLineRef.current = candleSeries.createPriceLine({ price: 0, color: "#60a5fa", lineWidth: 1 as LineWidth, lineStyle: 2, title: "" });

    const markers = createSeriesMarkers(candleSeries, []);

    chartRef.current      = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    markersRef.current    = markers;

    // 포지션 진입 전 캔들 미리 렌더
    const startIdx = candles.findIndex(c => c.time * 1000 >= posFrom);
    const initIdx  = Math.max(0, startIdx > 0 ? startIdx : 0);
    idxRef.current = initIdx; setIdx(initIdx);

    if (initIdx > 0) {
      candleSeries.setData(candles.slice(0, initIdx) as unknown as CandlestickData<Time>[]);
      volumeSeries.setData(candles.slice(0, initIdx).map(c => mkVol(c)) as HistogramData<Time>[]);
    }

    const onResize = () => { if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth }); };
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); chart.remove(); chartRef.current = null; };
  }, [candles, fills, posFrom]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function mkVol(c: Candle) {
    return { time: c.time as Time, value: c.volume, color: c.close >= c.open ? "#4ade8040" : "#f8717140" };
  }

  function applyMarkers(currentTime: number) {
    if (!markersRef.current) return;
    markersRef.current.setMarkers(
      fills.filter(f => Math.floor(f.time / 1000) <= currentTime).map(f => ({
        time: Math.floor(f.time / 1000) as Time,
        position: f.isBuy ? "belowBar" : "aboveBar",
        color: f.isBuy ? "#4ade80" : "#f87171",
        shape: f.isBuy ? "arrowUp" : "arrowDown",
        text: f.isBuy ? "Buy" : "Sell", size: 1,
      }))
    );
  }

  // Bitget 방식: 수수료 포함 가중평균, 부분청산 시 평단가 유지, 실현손익 누적
  function calcAvgEntry(upToTime: number): { avg: number; heldSize: number; realizedPnl: number } {
    let avg = 0;
    let heldSize = 0;
    let realizedPnl = 0;
    const dir = side === "long" ? 1 : -1;
    for (const f of fills) {
      if (Math.floor(f.time / 1000) > upToTime) break;
      if (f.type === "ENTRY" || f.type === "ADD") {
        const cost = f.price * f.size + Math.abs(f.fee);
        avg = (avg * heldSize + cost) / (heldSize + f.size);
        heldSize += f.size;
      } else {
        // 실현손익 = (청산가 - 평단가) × 수량 × 방향 + 수수료
        realizedPnl += (f.price - avg) * f.size * dir + f.fee;
        heldSize = Math.max(0, heldSize - f.size);
        if (f.type === "CLOSE" && heldSize < 1e-8) avg = 0;
      }
    }
    return { avg, heldSize, realizedPnl };
  }

  function updateAvgLine(currentTime: number) {
    if (!avgLineRef.current) return;
    const { avg } = calcAvgEntry(currentTime);
    avgLineRef.current.applyOptions({ price: avg, title: avg > 0 ? `Avg Entry ${fmtPrice(avg)}` : "" });
  }

  // ── Playback ─────────────────────────────────────────────────────────────────

  const stopInterval = () => {
    if (intervalRef.current) { globalThis.clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  const tick = useCallback(() => {
    const cs = candleSeriesRef.current;
    const vs = volumeSeriesRef.current;
    if (!cs || !vs) return;
    const cur = idxRef.current;
    if (cur >= candles.length) { stopInterval(); setPlaying(false); return; }

    const c = candles[cur];
    cs.update({ time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close });
    vs.update(mkVol(c) as HistogramData<Time>);
    applyMarkers(c.time);
    updateAvgLine(c.time);

    // 사이드바에서 현재 fill 카드로 스크롤
    const newIdx = cur + 1;
    idxRef.current = newIdx;
    setIdx(newIdx);
  }, [candles, fills]); // eslint-disable-line react-hooks/exhaustive-deps

  const play = useCallback(() => {
    if (idxRef.current >= candles.length) { idxRef.current = 0; setIdx(0); }
    setPlaying(true);
    intervalRef.current = globalThis.setInterval(tick, SPEED_MS[speed] ?? 200);
  }, [tick, speed, candles.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const pause = useCallback(() => { stopInterval(); setPlaying(false); }, []);

  const reset = useCallback(() => {
    stopInterval(); setPlaying(false);
    idxRef.current = 0; setIdx(0);
    candleSeriesRef.current?.setData([]);
    volumeSeriesRef.current?.setData([]);
    markersRef.current?.setMarkers([]);
    avgLineRef.current?.applyOptions({ price: 0, title: "" });
  }, []);

  useEffect(() => { return () => stopInterval(); }, []);

  useEffect(() => {
    if (playing) { stopInterval(); intervalRef.current = globalThis.setInterval(tick, SPEED_MS[speed] ?? 200); }
  }, [speed, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Current state ─────────────────────────────────────────────────────────────

  const currentTime = candles[Math.max(0, idx - 1)]?.time ?? 0;
  const { avg: avgEntry, heldSize, realizedPnl } = calcAvgEntry(currentTime);
  const currentPrice = candles[Math.max(0, idx - 1)]?.close ?? 0;
  const positionSizeUsdt = heldSize > 0 && currentPrice > 0 ? heldSize * currentPrice : 0;
  const unrealizedPnl = heldSize > 0 && currentPrice > 0 && avgEntry > 0
    ? heldSize * (currentPrice - avgEntry) * (side === "long" ? 1 : -1)
    : null;

  const progress = candles.length > 0 ? (idx / candles.length) * 100 : 0;

  // 현재 활성 fill 인덱스 (사이드바 하이라이트)
  const activeFills = fills.filter(f => Math.floor(f.time / 1000) <= currentTime);
  const activeFillIds = new Set(activeFills.map(f => f.id));

  // 사이드바 자동 스크롤 — 마지막 active fill ID 기준으로 정확히 감지
  const lastActiveFillId = activeFills[activeFills.length - 1]?.id ?? null;
  useEffect(() => {
    if (!sidebarRef.current) return;
    const lastActive = sidebarRef.current.querySelector('[data-active="true"]');
    if (lastActive) lastActive.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [lastActiveFillId]);

  // ── Seek ─────────────────────────────────────────────────────────────────────

  const handleSeek = (v: number) => {
    stopInterval(); setPlaying(false);
    idxRef.current = v; setIdx(v);
    const slice = candles.slice(0, v);
    candleSeriesRef.current?.setData(slice as unknown as CandlestickData<Time>[]);
    volumeSeriesRef.current?.setData(slice.map(mkVol) as HistogramData<Time>[]);
    if (v > 0) { applyMarkers(candles[v - 1].time); updateAvgLine(candles[v - 1].time); }
    else { markersRef.current?.setMarkers([]); avgLineRef.current?.applyOptions({ price: 0, title: "" }); }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white select-none">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-900 border-b border-gray-800 shrink-0 min-w-0">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-xl leading-none shrink-0">←</button>
        <span className="font-bold text-white shrink-0">{label}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full text-black shrink-0 ${side === "long" ? "bg-green-500" : "bg-red-500"}`}>
          {side === "long" ? "Long" : "Short"}
        </span>
        <span className="text-xs text-gray-500 shrink-0">{fmtTime(posFrom, utcOffset)} → {fmtTime(posTo, utcOffset)}</span>
        {unrealizedPnl !== null && (
          <span className="ml-auto text-sm font-semibold shrink-0" style={{ color: pnlColor(unrealizedPnl) }}>
            Unrealized: {fmtPnl(unrealizedPnl)} USDT
          </span>
        )}
      </div>

      {/* Main: chart + sidebar */}
      <div className="flex flex-1 min-h-0">

        {/* Chart */}
        <div className="flex-1 relative min-w-0">
          {(loading || error) && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-950 z-10">
              {loading
                ? <div className="text-gray-400 text-sm animate-pulse">캔들 데이터 로딩 중...</div>
                : <div className="text-red-400 text-sm">{error}</div>}
            </div>
          )}
          <div ref={containerRef} className="w-full h-full" />
          {/* PnL overlay */}
          {(unrealizedPnl !== null || realizedPnl !== 0) && (
            <div className="absolute top-2 left-2 z-20 flex flex-wrap gap-x-4 gap-y-1 bg-gray-950/80 backdrop-blur-sm rounded-lg px-3 py-2 text-xs pointer-events-none">
              <span className="text-gray-400">Avg Entry: <span className="text-gray-100 font-medium">{fmtPrice(avgEntry)}</span></span>
              {positionSizeUsdt > 0 && (
                <span className="text-gray-400">Size: <span className="text-gray-100 font-medium">{fmtPrice(positionSizeUsdt)} USDT</span></span>
              )}
              {unrealizedPnl !== null && (
                <span className="text-gray-400">Unrealized: <span className="font-medium" style={{ color: pnlColor(unrealizedPnl) }}>{fmtPnl(unrealizedPnl)} USDT</span></span>
              )}
              {realizedPnl !== 0 && (
                <span className="text-gray-400">Realized: <span className="font-medium" style={{ color: pnlColor(realizedPnl) }}>{fmtPnl(realizedPnl)} USDT</span></span>
              )}
              {unrealizedPnl !== null && realizedPnl !== 0 && (
                <span className="text-gray-400">Total: <span className="font-medium" style={{ color: pnlColor(unrealizedPnl + realizedPnl) }}>{fmtPnl(unrealizedPnl + realizedPnl)} USDT</span></span>
              )}
            </div>
          )}
        </div>

        {/* Sidebar: fills list */}
        <div className="w-64 shrink-0 bg-gray-900 border-l border-gray-800 flex flex-col">
          <div className="px-3 py-2 border-b border-gray-800 shrink-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Trade History</p>
            {heldSize > 0 && avgEntry > 0 && (
              <div className="mt-1.5 text-xs text-gray-400 space-y-0.5">
                <div className="flex justify-between"><span>Avg Entry</span><span className="text-white">{fmtPrice(avgEntry)}</span></div>
                <div className="flex justify-between"><span>Held</span><span className="text-white">{heldSize.toFixed(4)}</span></div>
              </div>
            )}
          </div>
          <div ref={sidebarRef} className="flex-1 overflow-y-auto">
            {fills.length === 0 && !loading && (
              <p className="text-xs text-gray-600 text-center py-8">매매 내역 없음</p>
            )}
            {fills.map((f, i) => {
              const isActive = activeFillIds.has(f.id);
              const isCurrent = isActive && (i === activeFills.length - 1);
              return (
                <div key={f.id} data-active={isCurrent ? "true" : "false"}>
                  <FillCard
                    fill={f} active={isCurrent} future={!isActive} utcOffset={utcOffset}
                    onSeek={() => {
                      const ci = candles.findIndex(c => c.time * 1000 >= f.time);
                      handleSeek(ci >= 0 ? ci : 0);
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>


      {/* Timeline */}
      <div className="px-4 py-1.5 bg-gray-900 border-t border-gray-800 shrink-0">
        <input type="range" min={0} max={candles.length} value={idx}
          onChange={e => handleSeek(parseInt(e.target.value))}
          className="w-full h-1 accent-green-500"
          style={{ background: `linear-gradient(to right, #22c55e ${progress}%, #374151 ${progress}%)` }}
        />
        <div className="flex justify-between text-xs text-gray-600 mt-0.5">
          <span>{candles[idx] ? fmtTime(candles[idx].time * 1000, utcOffset) : fmtTime(posFrom, utcOffset)}</span>
          <span>{idx} / {candles.length}</span>
          <span>{fmtTime(posTo, utcOffset)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-900 border-t border-gray-800 shrink-0">
        <button onClick={reset} title="처음으로" className="text-gray-400 hover:text-white text-lg">⏮</button>
        <button onClick={playing ? pause : play} disabled={loading || candles.length === 0}
          className="w-9 h-9 rounded-full bg-green-500 hover:bg-green-400 disabled:opacity-40 text-black font-bold flex items-center justify-center transition-colors">
          {playing ? "⏸" : "▶"}
        </button>
        <div className="flex gap-1">
          {[1, 2, 4, 8].map(s => (
            <button key={s} onClick={() => setSpeed(s)}
              className={`px-2 py-0.5 rounded text-xs border transition-colors ${speed === s ? "border-green-500 text-green-400 bg-green-900/30" : "border-gray-700 text-gray-500 hover:border-gray-500"}`}>
              {s}×
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-4">
          {/* UTC offset */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 shrink-0">UTC</span>
            <select
              value={utcOffset}
              onChange={e => {
                const v = Number(e.target.value);
                setUtcOffset(v);
                localStorage.setItem("fj_replay_utc", String(v));
              }}
              className="bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-xs text-white outline-none focus:border-green-500 cursor-pointer">
              {Array.from({ length: 24 }, (_, i) => i - 10).map(offset => (
                <option key={offset} value={offset}>
                  {offset >= 0 ? `+${offset}` : String(offset)}
                </option>
              ))}
            </select>
          </div>
          {/* TF */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">TF</span>
            <div className="flex gap-1">
              {TF_OPTIONS.map(t => (
                <button key={t}
                  onClick={() => { if (t !== tf) { pause(); setTf(t); setIdx(0); idxRef.current = 0; } }}
                  className={`px-2 py-0.5 rounded text-xs border transition-colors ${tf === t ? "border-green-500 text-green-400 bg-green-900/30" : "border-gray-700 text-gray-500 hover:border-gray-500"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReplayPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-gray-950 flex items-center justify-center text-gray-400">로딩 중...</div>}>
      <ReplayInner />
    </Suspense>
  );
}
