'use client';
// 백테스트 세션 목록 + 새 세션 생성
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface BTSession {
  id: string;
  name: string;
  symbol: string;
  startTime: number;
  endTime: number;
  initialSeed: number;
  status: string;
  createdAt: string;
  trades: { id: string; status: string; pnl: number | null }[];
}

const SAMPLE_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"];

export default function BacktestMain() {
  const [sessions, setSessions] = useState<BTSession[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showNew, setShowNew]   = useState(false);

  // 새 세션 폼
  const [name, setName]         = useState("");
  const [symbol, setSymbol]     = useState("BTCUSDT");
  const [customSymbol, setCustomSymbol] = useState("");
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); });
  const [endDate, setEndDate]   = useState(new Date().toISOString().slice(0, 10));
  const [seed, setSeed]         = useState("1000");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res  = await fetch("/api/backtest/sessions");
    const json = await res.json();
    if (json.success) setSessions(json.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    const sym = symbol === "_custom" ? customSymbol.toUpperCase() : symbol;
    if (!name.trim() || !sym) return;
    setCreating(true);
    try {
      const res  = await fetch("/api/backtest/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, symbol: sym,
          startTime: new Date(startDate).getTime(),
          endTime:   new Date(endDate).getTime() + 86399999,
          initialSeed: parseFloat(seed) || 1000,
        }),
      });
      const json = await res.json();
      if (json.success) {
        window.location.href = `/backtest/${json.data.id}`;
      }
    } finally { setCreating(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 세션을 삭제할까요?")) return;
    await fetch(`/api/backtest/sessions/${id}`, { method: "DELETE" });
    setSessions(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="mb-1"><Link href="/dashboard" className="text-gray-500 hover:text-gray-300 text-sm">← 대시보드</Link></div>
            <h1 className="text-2xl font-bold text-white">백테스트</h1>
            <p className="text-gray-400 text-sm mt-0.5">과거 차트에서 가상 매매로 전략을 검증하세요</p>
          </div>
          <button onClick={() => setShowNew(true)}
            className="px-4 py-2 bg-green-500 hover:bg-green-400 text-black text-sm font-semibold rounded-lg transition-colors">
            + 새 세션
          </button>
        </div>

        <div className="bg-gray-900/50 border border-yellow-700/30 rounded-xl px-4 py-3 mb-6 text-xs text-yellow-400">
          ⚠️ 백테스트는 학습 도구입니다. 과거 수익이 미래 수익을 보장하지 않습니다.
        </div>

        {/* 새 세션 폼 */}
        {showNew && (
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 mb-6">
            <h2 className="text-white font-semibold mb-4">새 백테스트 세션</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">세션 이름</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="예: BTC 4월 전략 검증"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-600 outline-none focus:border-green-500 transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">종목</label>
                  <select value={symbol} onChange={e => setSymbol(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-green-500 transition-colors">
                    {SAMPLE_SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
                    <option value="_custom">직접 입력</option>
                  </select>
                  {symbol === "_custom" && (
                    <input value={customSymbol} onChange={e => setCustomSymbol(e.target.value)} placeholder="BTCUSDT"
                      className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-green-500 transition-colors" />
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">초기 시드 (USDT)</label>
                  <input value={seed} onChange={e => setSeed(e.target.value)} type="number" min="100"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-green-500 transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">시작 날짜</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-green-500 transition-colors" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">종료 날짜</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-green-500 transition-colors" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowNew(false)} className="flex-1 py-2.5 rounded-xl bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 transition-colors">취소</button>
                <button onClick={handleCreate} disabled={!name.trim() || creating}
                  className="flex-1 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 disabled:opacity-40 text-black text-sm font-semibold transition-colors">
                  {creating ? "생성 중..." : "시작하기"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 세션 목록 */}
        {loading ? (
          <div className="text-center py-12 text-gray-500 text-sm">불러오는 중...</div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-gray-400">아직 백테스트 세션이 없습니다</p>
            <p className="text-gray-600 text-sm mt-1">과거 차트에서 실제처럼 매매를 연습해 보세요</p>
            <button onClick={() => setShowNew(true)} className="mt-4 px-5 py-2.5 bg-green-500 hover:bg-green-400 text-black text-sm font-semibold rounded-lg transition-colors">
              첫 세션 시작
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map(s => {
              const closed = s.trades.filter(t => t.status === "closed");
              const totalPnl = closed.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
              const winRate  = closed.length > 0 ? (closed.filter(t => (t.pnl ?? 0) > 0).length / closed.length * 100).toFixed(0) : null;
              const finalSeed = s.initialSeed + totalPnl;

              return (
                <div key={s.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${s.status === 'completed' ? 'bg-gray-700/50 border-gray-600 text-gray-400' : 'bg-green-500/10 border-green-500/30 text-green-400'}`}>
                          {s.status === 'completed' ? '완료' : '진행중'}
                        </span>
                        <h3 className="text-white font-medium text-sm truncate">{s.name}</h3>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                        <span>{s.symbol}</span>
                        <span>{new Date(s.startTime).toLocaleDateString("ko-KR")} ~ {new Date(s.endTime).toLocaleDateString("ko-KR")}</span>
                        <span>{s.trades.length}회 거래</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-sm font-semibold ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)} USDT
                      </div>
                      {winRate !== null && <div className="text-xs text-gray-500">승률 {winRate}%</div>}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Link href={`/backtest/${s.id}`}
                      className="flex-1 text-center py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs transition-colors">
                      {s.status === "completed" ? "결과 보기" : "이어하기"}
                    </Link>
                    {s.status === "completed" && (
                      <Link href={`/backtest/${s.id}/result`}
                        className="flex-1 text-center py-1.5 rounded-lg bg-blue-900/30 hover:bg-blue-900/50 border border-blue-700/30 text-blue-400 text-xs transition-colors">
                        상세 결과
                      </Link>
                    )}
                    <button onClick={() => handleDelete(s.id)}
                      className="px-3 py-1.5 rounded-lg bg-red-900/20 hover:bg-red-900/40 text-red-400 text-xs transition-colors">
                      삭제
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
