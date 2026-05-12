'use client';
// 백테스트 세션 결과 페이지
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { StatsResult } from "@/lib/stats";

interface BTTrade {
  id: string; side: string; entryPrice: number; exitPrice: number | null;
  size: number; leverage: number; entryTime: number; exitTime: number | null; pnl: number | null; status: string;
}
interface BTSession {
  id: string; name: string; symbol: string;
  startTime: number; endTime: number; initialSeed: number; status: string;
  trades: BTTrade[];
}

function fmtPnl(n: number) { return (n >= 0 ? "+" : "") + n.toFixed(2); }
function pnlCls(n: number) { return n > 0 ? "text-green-400" : n < 0 ? "text-red-400" : "text-gray-400"; }
function fmtPrice(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1) return n.toFixed(2);
  if (abs >= 0.01) return n.toFixed(4);
  return n.toFixed(6);
}

export default function BacktestResultPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const [session, setSession] = useState<BTSession | null>(null);
  const [realStats, setRealStats] = useState<StatsResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/backtest/sessions/${sessionId}`)
      .then(r => r.json())
      .then(async json => {
        if (!json.success) return;
        const s: BTSession = json.data;
        setSession(s);
        // 같은 기간 실거래 통계 조회
        const statsRes = await fetch(`/api/stats?startTime=${s.startTime}&endTime=${s.endTime}`);
        const statsJson = await statsRes.json();
        if (statsJson.success && statsJson.data.summary.totalTrades > 0) {
          setRealStats(statsJson.data);
        }
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">로딩 중...</div>;
  if (!session) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-red-400">세션을 찾을 수 없습니다</div>;

  const closed = session.trades.filter(t => t.status === "closed");
  const totalPnl = closed.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const finalSeed = session.initialSeed + totalPnl;
  const roi = session.initialSeed > 0 ? (totalPnl / session.initialSeed * 100) : 0;
  const winRate = closed.length > 0 ? (closed.filter(t => (t.pnl ?? 0) > 0).length / closed.length * 100) : 0;
  const bestTrade  = closed.reduce<BTTrade | null>((best, t) => !best || (t.pnl ?? 0) > (best.pnl ?? 0) ? t : best, null);
  const worstTrade = closed.reduce<BTTrade | null>((worst, t) => !worst || (t.pnl ?? 0) < (worst.pnl ?? 0) ? t : worst, null);
  const avgPnl = closed.length > 0 ? totalPnl / closed.length : 0;

  // Cumulative seed over time
  let runSeed = session.initialSeed;
  const seedHistory: { time: number; seed: number }[] = [{ time: session.startTime, seed: runSeed }];
  const sortedClosed = [...closed].sort((a, b) => (a.exitTime ?? 0) - (b.exitTime ?? 0));
  for (const t of sortedClosed) {
    runSeed += t.pnl ?? 0;
    seedHistory.push({ time: t.exitTime ?? 0, seed: runSeed });
  }

  const maxSeed = Math.max(...seedHistory.map(h => h.seed));
  const minSeed = Math.min(...seedHistory.map(h => h.seed));
  const seedRange = maxSeed - minSeed || 1;

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/backtest" className="text-gray-500 hover:text-gray-300 text-sm">← 백테스트</Link>
          <h1 className="text-2xl font-bold text-white">결과</h1>
        </div>
        <p className="text-gray-400 text-sm mb-6">{session.name} · {session.symbol}</p>

        {/* 핵심 지표 */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[
            { label: "최종 시드", value: `$${finalSeed.toFixed(2)}`, cls: pnlCls(totalPnl) },
            { label: "총 수익률", value: `${fmtPnl(roi)}%`, cls: pnlCls(roi) },
            { label: "순손익", value: `${fmtPnl(totalPnl)} USDT`, cls: pnlCls(totalPnl) },
            { label: "승률", value: closed.length > 0 ? `${winRate.toFixed(1)}%` : "-", cls: pnlCls(winRate - 50) },
            { label: "총 거래", value: `${closed.length}회`, cls: "text-white" },
            { label: "평균 손익", value: closed.length > 0 ? `${fmtPnl(avgPnl)} USDT` : "-", cls: pnlCls(avgPnl) },
          ].map(({ label, value, cls }) => (
            <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className={`text-xl font-bold ${cls}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* 시드 변화 그래프 */}
        {seedHistory.length > 1 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">시드 변화</p>
            <div className="h-24 flex items-end gap-0.5">
              {seedHistory.map((h, i) => {
                const height = ((h.seed - minSeed) / seedRange * 100).toFixed(0);
                return (
                  <div key={i} className="flex-1 flex flex-col justify-end" title={`$${h.seed.toFixed(2)}`}>
                    <div className={`w-full rounded-sm ${h.seed >= session.initialSeed ? 'bg-green-500/70' : 'bg-red-500/70'}`}
                      style={{ height: `${Math.max(2, parseFloat(height))}%` }} />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-600">
              <span>시작 ${session.initialSeed}</span>
              <span>최종 ${finalSeed.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* 최고/최저 거래 */}
        {(bestTrade || worstTrade) && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            {bestTrade && (
              <div className="bg-gray-900 border border-green-800/30 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">최고 거래</p>
                <p className="text-green-400 font-semibold">{fmtPnl(bestTrade.pnl ?? 0)} USDT</p>
                <p className="text-gray-500 text-xs mt-0.5">{bestTrade.side.toUpperCase()} · {fmtPrice(bestTrade.entryPrice)} → {fmtPrice(bestTrade.exitPrice ?? 0)}</p>
              </div>
            )}
            {worstTrade && (
              <div className="bg-gray-900 border border-red-800/30 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">최저 거래</p>
                <p className="text-red-400 font-semibold">{fmtPnl(worstTrade.pnl ?? 0)} USDT</p>
                <p className="text-gray-500 text-xs mt-0.5">{worstTrade.side.toUpperCase()} · {fmtPrice(worstTrade.entryPrice)} → {fmtPrice(worstTrade.exitPrice ?? 0)}</p>
              </div>
            )}
          </div>
        )}

        {/* 거래 목록 */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">전체 거래</p>
          {closed.length === 0 ? (
            <p className="text-gray-600 text-sm">완료된 거래가 없습니다</p>
          ) : (
            <div className="space-y-2">
              {sortedClosed.map((t, i) => (
                <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500 w-4">{i + 1}</span>
                    <span className={t.side === "long" ? "text-green-400" : "text-red-400"}>{t.side.toUpperCase()}</span>
                    <span className="text-gray-400">{fmtPrice(t.entryPrice)} → {fmtPrice(t.exitPrice ?? 0)}</span>
                  </div>
                  <span className={`text-xs font-semibold ${pnlCls(t.pnl ?? 0)}`}>{fmtPnl(t.pnl ?? 0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 실거래와 비교 */}
        {realStats ? (
          <div className="bg-gray-900 border border-blue-800/30 rounded-xl p-5 mt-0">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-4">같은 기간 실거래 비교</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "승률", bt: `${closed.length > 0 ? winRate.toFixed(1) : "-"}%`, real: `${realStats.summary.winRate}%` },
                { label: "순손익", bt: `${fmtPnl(totalPnl)} U`, real: `${fmtPnl(realStats.summary.totalPnl)} U` },
                { label: "거래 횟수", bt: `${closed.length}회`, real: `${realStats.summary.totalTrades}회` },
              ].map(({ label, bt, real }) => (
                <div key={label} className="bg-gray-800 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-2">{label}</p>
                  <div className="flex justify-between items-center text-xs">
                    <div><div className="text-gray-400 mb-0.5">백테스트</div><div className="font-semibold text-white">{bt}</div></div>
                    <div className="text-gray-600">vs</div>
                    <div className="text-right"><div className="text-gray-400 mb-0.5">실거래</div><div className="font-semibold text-white">{real}</div></div>
                  </div>
                </div>
              ))}
            </div>
            {(() => {
              const btWr = closed.length > 0 ? winRate : 0;
              const realWr = realStats.summary.winRate;
              const diff = btWr - realWr;
              return (
                <p className="text-xs text-gray-500 mt-3">
                  {Math.abs(diff) < 10 ? "✅ 백테스트와 실거래 성과가 유사합니다 — 전략이 일관적입니다." :
                   diff > 10 ? "⚠️ 백테스트 승률이 실거래보다 높습니다 — 심리적 요인이 영향을 줄 수 있습니다." :
                   "ℹ️ 실거래 승률이 백테스트보다 높습니다 — 실전에서 더 유연하게 대응하고 있습니다."}
                </p>
              );
            })()}
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center text-xs text-gray-600 mt-0">
            이 기간 실거래 내역이 없어 비교할 수 없습니다
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <Link href={`/backtest/${sessionId}`}
            className="flex-1 text-center py-3 rounded-xl bg-gray-800 border border-gray-700 text-gray-300 text-sm hover:bg-gray-700 transition-colors">
            플레이어로 돌아가기
          </Link>
          <Link href="/backtest"
            className="flex-1 text-center py-3 rounded-xl bg-green-500 hover:bg-green-400 text-black text-sm font-semibold transition-colors">
            새 세션 시작
          </Link>
        </div>
      </div>
    </div>
  );
}
