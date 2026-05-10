'use client';
// 위반 내역 목록 + 통계 클라이언트 컴포넌트
import { useState, useEffect } from "react";
import { RULE_META, type RuleType } from "@/lib/rules-types";
import Link from "next/link";

interface Violation {
  id: string;
  ruleType: string;
  positionId: string;
  pnlImpact: number | null;
  detectedAt: string;
  rule: { type: string; enabled: boolean } | null;
}

interface RuleTypeStat {
  type: string;
  count: number;
  totalLoss: number;
  avgPnlPercent: number | null;
}

interface StatsData {
  byType: RuleTypeStat[];
  ruleViolatingPnl: number | null;
  totalViolations: number;
}

const RULE_ICONS: Partial<Record<RuleType, string>> = {
  time_block:   "🕐",
  cooldown:     "⏸",
  daily_limit:  "📉",
  psych_block:  "🧠",
  liq_distance: "⚡",
  loss_streak:  "🔥",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function ViolationsContent() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const [statsRes, listRes] = await Promise.all([
        fetch("/api/rules/stats"),
        fetch(`/api/rules/violations?from=${monthStart}`),
      ]);
      const [statsJson, listJson] = await Promise.all([statsRes.json(), listRes.json()]);
      if (statsJson.success) setStats(statsJson.data);
      if (listJson.success) setViolations(listJson.data);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="bg-gray-800 rounded-xl h-20" />)}
        </div>
        <div className="bg-gray-800 rounded-xl h-48" />
        <div className="bg-gray-800 rounded-xl h-64" />
      </div>
    );
  }

  const totalViolations = stats?.totalViolations ?? 0;
  const avgViolationPnl = stats?.ruleViolatingPnl ?? null;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">룰 위반 내역</h1>
          <p className="text-sm text-gray-500 mt-0.5">이번 달 기준</p>
        </div>
        <Link href="/rules" className="text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors">
          ← 룰 관리
        </Link>
      </div>

      {/* 요약 카드 4개 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "총 위반 횟수", value: `${totalViolations}회`, cls: totalViolations > 0 ? "text-red-400" : "text-white" },
          { label: "위반 거래 평균 손익", value: avgViolationPnl !== null ? `${avgViolationPnl >= 0 ? "+" : ""}${avgViolationPnl.toFixed(2)} U` : "─", cls: avgViolationPnl !== null && avgViolationPnl < 0 ? "text-red-400" : "text-white" },
          { label: "준수 거래 평균 손익", value: "─", cls: "text-gray-500" },
          { label: "개선 가능 %p", value: "─", cls: "text-gray-500" },
        ].map((c) => (
          <div key={c.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">{c.label}</p>
            <p className={`text-xl font-bold tabular-nums ${c.cls}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {totalViolations === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-gray-300 font-medium">이번 달 위반 없음</p>
          <p className="text-sm text-gray-500 mt-1">훌륭합니다! 룰을 잘 지키고 계십니다.</p>
        </div>
      ) : (
        <>
          {/* 룰 종류별 통계 */}
          {stats?.byType && stats.byType.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-300 mb-4">룰 종류별 위반</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    {["룰 종류", "위반 횟수", "누적 손익", "평균 손익"].map((h) => (
                      <th key={h} className="text-left text-xs text-gray-500 font-medium pb-2 pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.byType.map((row) => (
                    <tr key={row.type} className="border-b border-gray-800/50">
                      <td className="py-2 pr-4">
                        <span className="flex items-center gap-1.5">
                          <span>{RULE_ICONS[row.type as RuleType] ?? "📋"}</span>
                          <span className="text-gray-300">{RULE_META[row.type as RuleType]?.label ?? row.type}</span>
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-red-400 font-medium">{row.count}회</td>
                      <td className={`py-2 pr-4 tabular-nums font-medium ${row.totalLoss < 0 ? "text-red-400" : "text-green-400"}`}>
                        {row.totalLoss !== 0 ? `${row.totalLoss >= 0 ? "+" : ""}${row.totalLoss.toFixed(2)} U` : "─"}
                      </td>
                      <td className={`py-2 tabular-nums ${row.avgPnlPercent !== null && row.avgPnlPercent < 0 ? "text-red-400" : "text-gray-400"}`}>
                        {row.avgPnlPercent !== null ? `${row.avgPnlPercent >= 0 ? "+" : ""}${row.avgPnlPercent.toFixed(2)} U` : "─"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 위반 기록 타임라인 */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">위반 타임라인</h2>
            <div className="space-y-2">
              {violations.slice(0, 30).map((v) => (
                <div key={v.id} className="flex items-center gap-3 py-2 border-b border-gray-800/50 last:border-0">
                  <span className="text-lg shrink-0">{RULE_ICONS[v.ruleType as RuleType] ?? "📋"}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-300">
                      {RULE_META[v.ruleType as RuleType]?.label ?? v.ruleType}
                    </span>
                    <span className="text-xs text-gray-600 ml-2 font-mono truncate">{v.positionId.slice(0, 16)}…</span>
                  </div>
                  <div className="text-right shrink-0">
                    {v.pnlImpact !== null && (
                      <span className={`text-xs font-medium mr-3 ${v.pnlImpact < 0 ? "text-red-400" : "text-green-400"}`}>
                        {v.pnlImpact >= 0 ? "+" : ""}{v.pnlImpact.toFixed(2)} U
                      </span>
                    )}
                    <span className="text-xs text-gray-600">{fmtDate(v.detectedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* 인사이트 CTA */}
      <div className="bg-green-900/20 border border-green-400/20 rounded-xl p-4">
        <p className="text-sm text-green-400 font-medium mb-1">💡 AI 인사이트</p>
        <p className="text-sm text-gray-400">위반 패턴 분석을 통해 더 나은 인사이트를 얻고 싶다면 통계 페이지의 AI 분석을 활용해보세요.</p>
        <Link href="/stats" className="inline-block mt-2 text-xs text-green-400 hover:text-green-300 underline">
          통계 → AI 인사이트 보기
        </Link>
      </div>
    </div>
  );
}
