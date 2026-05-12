'use client';
// 백테스트 플레이어 — 캔들 순차 재생 + 가상 진입/청산
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  createChart, IChartApi, ISeriesApi,
  CandlestickSeries, CandlestickData, Time,
  createSeriesMarkers,
} from "lightweight-charts";

interface Candle { time: number; open: number; high: number; low: number; close: number; volume: number; }
interface BTSession {
  id: string; name: string; symbol: string;
  startTime: number; endTime: number; initialSeed: number; status: string;
  trades: BTTrade[];
}
interface BTTrade {
  id: string; side: string; entryPrice: number; exitPrice: number | null;
  size: number; leverage: number; entryTime: number; exitTime: number | null;
  pnl: number | null; status: string; stopLoss: number | null; takeProfit: number | null; closeReason: string | null;
}

const SPEED_MS = { 1: 300, 2: 150, 4: 75, 8: 35 } as const;
const FEE_RATE = 0.0004;

function fmtPrice(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1) return n.toFixed(2);
  if (abs >= 0.01) return n.toFixed(4);
  return n.toFixed(6);
}
function fmtPnl(n: number) { return (n >= 0 ? "+" : "") + n.toFixed(2); }
function pnlCls(n: number) { return n > 0 ? "text-green-400" : n < 0 ? "text-red-400" : "text-gray-400"; }

export default function BacktestPlayer({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const chartRef  = useRef<HTMLDivElement>(null);
  const chartInst = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any | null>(null);

  const [btSession, setBtSession] = useState<BTSession | null>(null);
  const [candles,   setCandles]   = useState<Candle[]>([]);
  const [revealed,  setRevealed]  = useState(0);
  const [playing,   setPlaying]   = useState(false);
  const [speed,     setSpeed]     = useState<1|2|4|8>(1);
  const [trades,    setTrades]    = useState<BTTrade[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");

  // Entry modal
  const [entryModal, setEntryModal] = useState(false);
  const [entrySide,  setEntrySide]  = useState<"long"|"short">("long");
  const [entrySize,  setEntrySize]  = useState("0.01");
  const [entryLev,   setEntryLev]   = useState("10");
  const [entrySL,    setEntrySL]    = useState("");
  const [entryTP,    setEntryTP]    = useState("");

  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const tradesRef  = useRef<BTTrade[]>(trades);      // setState 바깥에서 trades 읽기용
  const closingRef = useRef(new Set<string>());       // 중복 청산 방지

  // Load session + candles
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const sRes = await fetch(`/api/backtest/sessions/${sessionId}`);
        const sJson = await sRes.json();
        if (!sJson.success) { setError("세션을 찾을 수 없습니다"); return; }

        const s: BTSession = sJson.data;
        setBtSession(s);
        setTrades(s.trades);

        // Load candles via exchange/candles (using active exchange from localStorage or default bitget)
        const exchange = localStorage.getItem("fj_exchange") ?? "bitget";
        const cRes = await fetch(
          `/api/exchange/candles?symbol=${s.symbol}&tf=5m&from=${s.startTime}&to=${s.endTime}&exchange=${exchange}`
        );
        const cJson = await cRes.json();
        if (!cJson.success) { setError("캔들 데이터를 불러올 수 없습니다"); return; }
        setCandles(cJson.candles ?? []);
        setRevealed(Math.min(50, cJson.candles?.length ?? 0));
      } catch {
        setError("로드 실패");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sessionId]);

  // Init chart
  useEffect(() => {
    if (!chartRef.current || chartInst.current) return;
    const chart = createChart(chartRef.current, {
      layout: { background: { color: "#030712" }, textColor: "#9ca3af" },
      grid: { vertLines: { color: "#111827" }, horzLines: { color: "#111827" } },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: "#1f2937" },
      timeScale: { borderColor: "#1f2937", timeVisible: true },
      width: chartRef.current.clientWidth,
      height: 400,
    });
    const cs = chart.addSeries(CandlestickSeries, {
      upColor: "#4ade80", downColor: "#f87171",
      borderUpColor: "#4ade80", borderDownColor: "#f87171",
      wickUpColor: "#4ade80", wickDownColor: "#f87171",
    });
    const markers = createSeriesMarkers(cs, []);
    chartInst.current = chart;
    seriesRef.current = cs;
    markersRef.current = markers;

    const ro = new ResizeObserver(() => {
      if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth });
    });
    ro.observe(chartRef.current);
    return () => { ro.disconnect(); chart.remove(); chartInst.current = null; };
  }, []);

  // tradesRef 동기화 (setState 외부에서 trades 읽기 위해)
  useEffect(() => { tradesRef.current = trades; }, [trades]);

  // Update chart data when candles/revealed changes
  useEffect(() => {
    if (!seriesRef.current || candles.length === 0) return;
    const visible = candles.slice(0, revealed);
    seriesRef.current.setData(visible.map(c => ({ time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close })));
  }, [candles, revealed]);

  // Update markers when trades change
  useEffect(() => {
    if (!markersRef.current || !seriesRef.current) return;
    const ms = trades.flatMap(t => {
      const items = [];
      if (t.entryTime && t.entryPrice) {
        const candleTime = candles.find(c => c.time * 1000 >= t.entryTime)?.time ?? Math.floor(t.entryTime / 1000);
        items.push({ time: candleTime as Time, position: t.side === "long" ? "belowBar" as const : "aboveBar" as const, color: t.side === "long" ? "#4ade80" : "#f87171", shape: "arrowUp" as const, text: `진입 ${fmtPrice(t.entryPrice)}` });
      }
      if (t.exitTime && t.exitPrice) {
        const candleTime = candles.find(c => c.time * 1000 >= t.exitTime!)?.time ?? Math.floor(t.exitTime! / 1000);
        items.push({ time: candleTime as Time, position: "aboveBar" as const, color: "#facc15", shape: "arrowDown" as const, text: `청산 ${fmtPrice(t.exitPrice)}` });
      }
      return items;
    });
    markersRef.current.setMarkers(ms.sort((a, b) => (a.time as number) - (b.time as number)));
  }, [trades, candles]);

  // SL/TP 자동 청산 체크 — setState 외부에서 fetch, closingRef로 중복 방지
  const checkAutoClose = useCallback((candleIdx: number) => {
    const candle = candles[candleIdx];
    if (!candle) return;

    // tradesRef로 현재 trades 읽기 (setState updater 내부 side effect 방지)
    const openT = tradesRef.current.find(t => t.status === "open");
    if (!openT || (!openT.stopLoss && !openT.takeProfit)) return;
    if (closingRef.current.has(openT.id)) return; // 이미 처리 중

    const { high, low, time } = candle;
    let triggerPrice: number | null = null;
    let reason = "";

    if (openT.side === "long") {
      if (openT.takeProfit && high >= openT.takeProfit) { triggerPrice = openT.takeProfit; reason = "TP"; }
      else if (openT.stopLoss && low <= openT.stopLoss) { triggerPrice = openT.stopLoss; reason = "SL"; }
    } else {
      if (openT.takeProfit && low <= openT.takeProfit)  { triggerPrice = openT.takeProfit; reason = "TP"; }
      else if (openT.stopLoss && high >= openT.stopLoss){ triggerPrice = openT.stopLoss; reason = "SL"; }
    }

    if (triggerPrice !== null) {
      const exitTime = time * 1000;
      closingRef.current.add(openT.id); // 중복 청산 방지 마크

      // 낙관적 UI 업데이트 (순수 상태 업데이트만, side effect 없음)
      setTrades(prev => prev.map(t => t.id === openT.id
        ? { ...t, exitPrice: triggerPrice!, exitTime, status: "closed", closeReason: reason }
        : t
      ));

      // fetch는 setState 완전히 바깥에서 실행
      fetch(`/api/backtest/trades/${openT.id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exitPrice: triggerPrice, exitTime, closeReason: reason }),
      }).then(r => r.json()).then(json => {
        if (json.success) setTrades(p => p.map(t => t.id === openT.id ? json.data : t));
      });
    }
  }, [candles]);

  // Play/pause
  const tick = useCallback(() => {
    setRevealed(prev => {
      if (prev >= candles.length) { setPlaying(false); return prev; }
      checkAutoClose(prev); // 새로 드러나는 캔들로 SL/TP 체크
      return prev + 1;
    });
  }, [candles.length, checkAutoClose]);

  useEffect(() => {
    if (playing) {
      timerRef.current = setInterval(tick, SPEED_MS[speed]);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing, speed, tick]);

  const currentCandle = candles[revealed - 1];
  const currentPrice  = currentCandle?.close ?? 0;
  const currentTime   = currentCandle ? currentCandle.time * 1000 : 0;

  // Seed calculation
  const closedTrades = trades.filter(t => t.status === "closed");
  const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const currentSeed = (btSession?.initialSeed ?? 1000) + totalPnl;

  // Open position
  const openTrade = trades.find(t => t.status === "open");

  // Lookahead bias 방지: 진입은 다음 캔들 시가로 체결
  // nextCandle이 없으면(마지막 캔들) 진입 자체를 차단
  const nextCandle     = candles[revealed];
  const entryPrice     = nextCandle?.open ?? 0;
  const entryTime      = nextCandle ? nextCandle.time * 1000 : 0;
  const canEnter       = !!nextCandle && !openTrade;
  const nearEndWarning = candles.length > 0 && revealed >= candles.length - 1 && !nextCandle;
  const unrealizedPnl = openTrade && currentPrice
    ? (openTrade.side === "long"
        ? (currentPrice - openTrade.entryPrice) * openTrade.size * openTrade.leverage
        : (openTrade.entryPrice - currentPrice) * openTrade.size * openTrade.leverage)
      - openTrade.entryPrice * openTrade.size * FEE_RATE
    : null;

  const handleEntry = async () => {
    if (!canEnter || !entryTime || !entryPrice) return;
    setEntryModal(false);
    // 다음 캔들 시가로 체결 후 캔들 1개 진행
    setRevealed(prev => Math.min(prev + 1, candles.length));
    const res  = await fetch("/api/backtest/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId, side: entrySide, entryPrice,
        size: parseFloat(entrySize) || 0.01, leverage: parseFloat(entryLev) || 1,
        entryTime,
        stopLoss:   entrySL ? parseFloat(entrySL) : null,
        takeProfit: entryTP ? parseFloat(entryTP) : null,
      }),
    });
    const json = await res.json();
    if (json.success) setTrades(prev => [...prev, json.data]);
  };

  const handleClose = async () => {
    if (!openTrade || !currentTime || !currentPrice) return;
    const res  = await fetch(`/api/backtest/trades/${openTrade.id}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exitPrice: currentPrice, exitTime: currentTime }),
    });
    const json = await res.json();
    if (json.success) setTrades(prev => prev.map(t => t.id === openTrade.id ? json.data : t));
  };

  const handleComplete = async () => {
    if (!confirm("세션을 완료 처리하고 결과 페이지로 이동할까요?")) return;
    await fetch(`/api/backtest/sessions/${sessionId}/complete`, { method: "POST" });
    router.push(`/backtest/${sessionId}/result`);
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">로딩 중...</div>;
  if (error)   return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-red-400">{error}</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top bar */}
      <div className="border-b border-gray-800 px-4 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/backtest")} className="text-gray-500 hover:text-white text-sm">← 목록</button>
          <div>
            <span className="font-semibold text-sm">{btSession?.symbol}</span>
            <span className="text-gray-500 text-xs ml-2">{btSession?.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-400">시드:</span>
          <span className={`font-semibold ${pnlCls(currentSeed - (btSession?.initialSeed ?? 1000))}`}>
            ${currentSeed.toFixed(2)}
          </span>
          <span className="text-gray-600">({fmtPnl(totalPnl)})</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPlaying(p => !p)}
            className="px-4 py-1.5 bg-green-500 hover:bg-green-400 text-black text-sm font-semibold rounded-lg transition-colors">
            {playing ? "⏸ 일시정지" : "▶ 재생"}
          </button>
          {([1,2,4,8] as const).map(s => (
            <button key={s} onClick={() => setSpeed(s)}
              className={`px-2.5 py-1 text-xs rounded border transition-colors ${speed === s ? 'bg-green-500/20 border-green-500 text-green-400' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}>
              {s}×
            </button>
          ))}
          <button onClick={handleComplete} className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors">세션 종료</button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-56px)]">
        {/* Chart area */}
        <div className="flex-1 flex flex-col">
          <div ref={chartRef} className="flex-1" />
          {/* Controls */}
          <div className="border-t border-gray-800 p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm text-gray-400">
              {currentCandle ? `${new Date(currentCandle.time * 1000).toLocaleString("ko-KR")} · ${fmtPrice(currentPrice)}` : "재생 시작"}
            </div>
            <div className="flex gap-2">
              {!openTrade ? (
                <>
                  {nearEndWarning && (
                    <span className="text-xs text-yellow-500">마지막 캔들 — 다음 시가 없음</span>
                  )}
                  <button onClick={() => { setEntrySide("long"); setEntryModal(true); }}
                    disabled={!canEnter}
                    title={!canEnter ? "다음 캔들이 없어 진입할 수 없습니다" : undefined}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors">
                    🟢 LONG 진입
                  </button>
                  <button onClick={() => { setEntrySide("short"); setEntryModal(true); }}
                    disabled={!canEnter}
                    title={!canEnter ? "다음 캔들이 없어 진입할 수 없습니다" : undefined}
                    className="px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors">
                    🔴 SHORT 진입
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <div className={`text-sm font-semibold ${pnlCls(unrealizedPnl ?? 0)}`}>
                    {openTrade.side.toUpperCase()} @ {fmtPrice(openTrade.entryPrice)}
                    {unrealizedPnl !== null && <span className="ml-2">{fmtPnl(unrealizedPnl)} USDT</span>}
                  </div>
                  <button onClick={handleClose}
                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-black text-sm font-semibold rounded-lg transition-colors">
                    청산
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-56 border-l border-gray-800 flex flex-col text-xs">
          <div className="p-3 border-b border-gray-800">
            <p className="text-gray-500 uppercase tracking-wide mb-2">세션 통계</p>
            <div className="space-y-1.5">
              <div className="flex justify-between"><span className="text-gray-400">총 거래</span><span>{trades.length}회</span></div>
              <div className="flex justify-between"><span className="text-gray-400">완료</span><span>{closedTrades.length}회</span></div>
              <div className="flex justify-between"><span className="text-gray-400">승률</span>
                <span>{closedTrades.length > 0 ? Math.round(closedTrades.filter(t => (t.pnl ?? 0) > 0).length / closedTrades.length * 100) + "%" : "-"}</span>
              </div>
              <div className="flex justify-between"><span className="text-gray-400">순손익</span>
                <span className={pnlCls(totalPnl)}>{fmtPnl(totalPnl)}</span>
              </div>
              <div className="flex justify-between"><span className="text-gray-400">진행률</span>
                <span>{candles.length > 0 ? Math.round(revealed / candles.length * 100) + "%" : "-"}</span>
              </div>
            </div>
          </div>

          <div className="p-3 flex-1 overflow-y-auto">
            <p className="text-gray-500 uppercase tracking-wide mb-2">거래 내역</p>
            <div className="space-y-2">
              {[...trades].reverse().map(t => (
                <div key={t.id} className={`p-2 rounded-lg border text-xs ${t.status === 'open' ? 'border-yellow-700/50 bg-yellow-900/10' : 'border-gray-800 bg-gray-900/50'}`}>
                  <div className="flex justify-between mb-0.5">
                    <span className={t.side === "long" ? "text-green-400" : "text-red-400"}>{t.side.toUpperCase()}</span>
                    {t.status === "open" ? <span className="text-yellow-400">오픈</span> : <span className={pnlCls(t.pnl ?? 0)}>{fmtPnl(t.pnl ?? 0)}</span>}
                  </div>
                  <div className="text-gray-500">{fmtPrice(t.entryPrice)}{t.exitPrice ? ` → ${fmtPrice(t.exitPrice)}` : ""}</div>
                </div>
              ))}
              {trades.length === 0 && <p className="text-gray-600">아직 거래 없음</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Entry modal */}
      {entryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-white font-semibold mb-4">{entrySide === "long" ? "🟢 LONG" : "🔴 SHORT"} 진입</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">수량</label>
                <input value={entrySize} onChange={e => setEntrySize(e.target.value)} type="number" step="0.001"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-green-500 transition-colors" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">레버리지</label>
                <input value={entryLev} onChange={e => setEntryLev(e.target.value)} type="number" min="1" max="125"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-green-500 transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">손절가 (선택)</label>
                  <input value={entrySL} onChange={e => setEntrySL(e.target.value)} type="number" step="any" placeholder="0"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-red-500 transition-colors" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">익절가 (선택)</label>
                  <input value={entryTP} onChange={e => setEntryTP(e.target.value)} type="number" step="any" placeholder="0"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-green-500 transition-colors" />
                </div>
              </div>
              <div className="text-xs text-gray-500 bg-gray-800 rounded-lg px-3 py-2 space-y-0.5">
                <div className="text-yellow-400/80">⚡ 다음 캔들 시가로 체결됩니다</div>
                <div>예상 진입가: {fmtPrice(entryPrice)} · 예상 증거금: ${(entryPrice * parseFloat(entrySize || "0") / parseFloat(entryLev || "1")).toFixed(2)}</div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setEntryModal(false)} className="flex-1 py-2.5 rounded-xl bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 transition-colors">취소</button>
              <button onClick={handleEntry} className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition-colors ${entrySide === "long" ? "bg-green-600 hover:bg-green-500" : "bg-red-700 hover:bg-red-600"}`}>진입</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
