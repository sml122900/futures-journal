'use client';
// AI 매매 인사이트 카드 (7일 캐시, 크레딧 15개)
import { useState, useEffect } from "react";

interface InsightData {
  insight: string;
  generatedAt: string;
  cached: boolean;
}

export default function InsightCard() {
  const [data, setData] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchInsight(force = false) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stats/insight${force ? "?force=true" : ""}`);
      const json = await res.json();
      if (!json.success) {
        if (json.message === "INSUFFICIENT_CREDITS") {
          setError(`크레딧 부족 (보유: ${json.data.current}c / 필요: ${json.data.required}c)`);
        } else {
          setError(json.message ?? "인사이트 로드 실패");
        }
        return;
      }
      setData(json.data);
    } catch {
      setError("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchInsight(); }, []);

  /** 캐시 생성일로부터 경과 일수 */
  function daysAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "오늘";
    return `${days}일 전`;
  }

  function handleRefresh() {
    if (!window.confirm("새 인사이트를 생성합니다. 크레딧 15개가 차감됩니다. 계속하시겠습니까?")) return;
    fetchInsight(true);
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🎯</span>
          <h2 className="text-sm font-semibold text-gray-300">이번 주의 발견</h2>
          {data?.cached && (
            <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">
              {daysAgo(data.generatedAt)} 분석
            </span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 bg-gray-800 hover:bg-gray-700 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40"
        >
          <span className={loading ? "animate-spin" : ""}>↻</span>
          재생성 (15c)
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="animate-pulse bg-gray-800 h-4 rounded w-full" />
          <div className="animate-pulse bg-gray-800 h-4 rounded w-5/6" />
          <div className="animate-pulse bg-gray-800 h-4 rounded w-4/6" />
        </div>
      ) : error ? (
        <div className="text-sm text-red-400">
          {error}
          {error.startsWith("크레딧 부족") && (
            <a href="/payments" className="ml-2 text-green-400 hover:text-green-300 underline">
              충전하기 →
            </a>
          )}
        </div>
      ) : data ? (
        <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">{data.insight}</p>
      ) : null}

      <p className="text-xs text-gray-600 mt-3">최근 7일 거래 기반 · Claude Sonnet</p>
    </div>
  );
}
