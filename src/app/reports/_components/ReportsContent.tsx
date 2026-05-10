'use client';
// AI 리포트 목록 + 생성 버튼 클라이언트 컴포넌트
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface ReportSummary {
  id: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  content: {
    summary: { trades: number; winRate: number; totalPnl: number };
    highlights: string[];
    coachComment: string;
  };
}

type ReportType = "weekly" | "monthly";

const COSTS: Record<ReportType, number> = { weekly: 30, monthly: 50 };
const LABELS: Record<ReportType, string> = { weekly: "주간", monthly: "월간" };

function fmtPeriod(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.getMonth() + 1}/${s.getDate()} ~ ${e.getMonth() + 1}/${e.getDate()}`;
}

export default function ReportsContent() {
  const [tab, setTab] = useState<ReportType>("weekly");
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (type: ReportType) => {
    setLoading(true);
    const res = await fetch(`/api/reports/${type}`);
    const json = await res.json();
    if (json.success) setReports(json.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(tab); }, [tab, load]);

  async function generate() {
    if (!window.confirm(`${LABELS[tab]} 리포트를 생성합니다. 크레딧 ${COSTS[tab]}개가 차감됩니다. 계속하시겠습니까?`)) return;
    setGenerating(true);
    setError("");
    try {
      const res = await fetch(`/api/reports/${tab}`, { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        if (json.message === "INSUFFICIENT_CREDITS") {
          setError(`크레딧 부족 (보유: ${json.data.current}c / 필요: ${json.data.required}c)`);
        } else {
          setError(json.message ?? "생성 실패");
        }
        return;
      }
      load(tab);
    } catch {
      setError("네트워크 오류");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">AI 리포트</h1>
          <p className="text-sm text-gray-500 mt-0.5">Claude가 매매 데이터를 분석한 주간/월간 리포트</p>
        </div>
        <button onClick={generate} disabled={generating}
          className="flex items-center gap-2 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold text-sm px-4 py-2 rounded-lg transition-colors">
          {generating ? "생성 중..." : `+ ${LABELS[tab]} 리포트 (${COSTS[tab]}c)`}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-900/20 border border-red-500/20 rounded-xl px-4 py-3">
          {error}
          {error.startsWith("크레딧") && <Link href="/payments" className="ml-2 text-green-400 underline">충전하기 →</Link>}
        </div>
      )}

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-0.5 w-fit">
        {(["weekly", "monthly"] as ReportType[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors font-medium ${
              tab === t ? "bg-green-600 text-white" : "text-gray-400 hover:text-white"
            }`}>
            {LABELS[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="animate-pulse bg-gray-800 rounded-xl h-40" />)}
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-gray-300 font-medium">아직 {LABELS[tab]} 리포트가 없습니다</p>
          <p className="text-sm text-gray-500 mt-1">위 버튼으로 첫 번째 리포트를 생성하세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map((r) => {
            const c = r.content;
            return (
              <Link key={r.id} href={`/reports/${r.id}`}
                className="bg-gray-900 border border-gray-800 rounded-xl p-4 shadow-sm hover:border-gray-700 transition-colors group">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{fmtPeriod(r.periodStart, r.periodEnd)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{new Date(r.createdAt).toLocaleDateString("ko-KR")}</p>
                  </div>
                  <span className="text-xs text-green-400 group-hover:text-green-300">보기 →</span>
                </div>

                <div className="flex gap-4 mb-3">
                  <div>
                    <p className="text-xs text-gray-500">거래수</p>
                    <p className="text-lg font-bold text-white">{c.summary.trades}회</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">승률</p>
                    <p className={`text-lg font-bold ${c.summary.winRate >= 50 ? "text-green-400" : "text-red-400"}`}>
                      {c.summary.winRate}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">순손익</p>
                    <p className={`text-lg font-bold tabular-nums ${c.summary.totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {c.summary.totalPnl >= 0 ? "+" : ""}{c.summary.totalPnl.toFixed(1)} U
                    </p>
                  </div>
                </div>

                {c.highlights?.[0] && (
                  <p className="text-xs text-gray-400 line-clamp-2 bg-gray-800 rounded-lg px-2.5 py-2">
                    🌟 {c.highlights[0]}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
