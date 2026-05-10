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
  const [period, setPeriod] = useState<Period>("30d");
  const [stats, setStats] = useState<StatsResult | null>(null);
  const [prevStats, setPrevStats] = useState<StatsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (p: Period) => {
    setLoading(true);
    setError(null);
    try {
      const now = Date.now();

      if (p === "all") {
        // 전체 기간: 비교 없음
        const res = await fetch("/api/stats?period=all");
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        setStats(json.data);
        setPrevStats(null);
      } else {
        // 현재 기간 + 직전 동일 기간 병렬 조회
        const ms = PERIOD_MS[p];
        const curEnd   = now;
        const curStart = now - ms;
        const prevEnd   = curStart;
        const prevStart = curStart - ms;

        const [curRes, prevRes] = await Promise.all([
          fetch(`/api/stats?startTime=${curStart}&endTime=${curEnd}`),
          fetch(`/api/stats?startTime=${prevStart}&endTime=${prevEnd}`),
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

  useEffect(() => { fetchStats(period); }, [period, fetchStats]);

  return (
    <div className="space-y-5">
      {/* 헤더 + 기간 토글 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">통계 분석</h1>
        <div className="flex items-center bg-gray-900 border border-gray-800 rounded-lg p-0.5">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                period === opt.value
                  ? "bg-green-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {opt.label}
            </button>
          ))}
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
