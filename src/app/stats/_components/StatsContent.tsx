'use client';
// 통계 대시보드 메인 클라이언트 컴포넌트
import { useState, useEffect, useCallback } from "react";
import type { StatsResult } from "@/lib/stats";
import InsightCard from "./InsightCard";
import SummaryStats from "./SummaryStats";
import PatternMatrix from "./PatternMatrix";
import TimeHeatmap from "./TimeHeatmap";
import SymbolStats from "./SymbolStats";

type Period = "7d" | "30d" | "90d" | "all";

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "7d",  label: "7일"  },
  { value: "30d", label: "30일" },
  { value: "90d", label: "90일" },
  { value: "all", label: "전체" },
];

/** 기간 키워드 → 밀리초 */
const PERIOD_MS: Record<string, number> = {
  "7d":  7  * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
};

/** 스켈레톤 플레이스홀더 */
function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* 요약 카드 4개 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-800 rounded-xl h-24" />
        ))}
      </div>
      {/* 인사이트 */}
      <div className="bg-gray-800 rounded-xl h-28" />
      {/* 패턴 매트릭스 */}
      <div className="bg-gray-800 rounded-xl h-48" />
      {/* 히트맵 */}
      <div className="bg-gray-800 rounded-xl h-52" />
      {/* 심볼 */}
      <div className="bg-gray-800 rounded-xl h-40" />
    </div>
  );
}

export default function StatsContent() {
  const [period, setPeriod]       = useState<Period>("30d");
  const [exchange, setExchange]   = useState("bitget");
  const [registeredExchanges, setRegisteredExchanges] = useState<string[]>([]);
  const [stats, setStats]         = useState<StatsResult | null>(null);
  const [prevStats, setPrevStats] = useState<StatsResult | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  // 통계 지원 거래소만 필터 (factory에 없는 거래소는 500 에러 발생)
  const SUPPORTED_EXCHANGES = ["bitget", "binance"];

  // 등록된 거래소 목록 로드 (지원 거래소만)
  useEffect(() => {
    fetch("/api/user/api-key")
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          const exs = (json.data.keys ?? [])
            .map((k: { exchange: string }) => k.exchange)
            .filter((e: string) => SUPPORTED_EXCHANGES.includes(e));
          setRegisteredExchanges(exs);
          const saved = typeof window !== "undefined" ? localStorage.getItem("fj_exchange") : null;
          if (saved && exs.includes(saved)) setExchange(saved);
          else if (exs.length > 0) setExchange(exs[0]);
        }
      }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchStats = useCallback(async (p: Period, exch: string) => {
    setLoading(true);
    setError(null);
    try {
      const now = Date.now();

      if (p === "all") {
        const res = await fetch(`/api/stats?period=all&exchange=${exch}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        setStats(json.data);
        setPrevStats(null);
      } else {
        const ms = PERIOD_MS[p];
        const curEnd    = now;
        const curStart  = now - ms;
        const prevEnd   = curStart;
        const prevStart = curStart - ms;

        const [curRes, prevRes] = await Promise.all([
          fetch(`/api/stats?startTime=${curStart}&endTime=${curEnd}&exchange=${exch}`),
          fetch(`/api/stats?startTime=${prevStart}&endTime=${prevEnd}&exchange=${exch}`),
        ]);

        const [curJson, prevJson] = await Promise.all([curRes.json(), prevRes.json()]);
        if (!curJson.success) throw new Error(curJson.message);

        setStats(curJson.data);
        setPrevStats(prevJson.success ? prevJson.data : null);
      }
    } catch (e) {
      setError((e as Error).message ?? "데이터 로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(period, exchange); }, [period, exchange, fetchStats]);

  return (
    <div className="space-y-5">
      {/* 헤더 + 필터 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-white">통계 분석</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {/* 거래소 필터 */}
          {registeredExchanges.length > 1 && (
            <div className="flex items-center bg-gray-900 border border-gray-800 rounded-lg p-0.5">
              {registeredExchanges.map((exch) => (
                <button key={exch} onClick={() => setExchange(exch)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    exchange === exch ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"
                  }`}>
                  {exch.charAt(0).toUpperCase() + exch.slice(1)}
                </button>
              ))}
            </div>
          )}
          {/* 기간 토글 */}
          <div className="flex items-center bg-gray-900 border border-gray-800 rounded-lg p-0.5">
            {PERIOD_OPTIONS.map((opt) => (
              <button key={opt.value} onClick={() => setPeriod(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  period === opt.value ? "bg-green-600 text-white" : "text-gray-400 hover:text-white"
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <Skeleton />
      ) : error ? (
        <div className="bg-red-900/30 border border-red-500/20 rounded-xl p-6 text-red-400 text-sm">
          {error}
        </div>
      ) : !stats || stats.summary.totalTrades === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-500 text-sm">선택한 기간에 거래 내역이 없습니다.</p>
        </div>
      ) : (
        <>
          {/* 요약 카드 */}
          <SummaryStats
            current={stats.summary}
            prev={prevStats?.summary}
          />

          {/* AI 인사이트 (항상 7일 기준) */}
          <InsightCard />

          {/* 패턴 매트릭스 */}
          <PatternMatrix data={stats.patternMatrix} />

          {/* 시간대별 히트맵 */}
          <TimeHeatmap data={stats.timeHeatmap} />

          {/* 심볼별 통계 */}
          <SymbolStats data={stats.symbolStats} />
        </>
      )}
    </div>
  );
}
