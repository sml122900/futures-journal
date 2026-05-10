'use client';
// 마일스톤 갤러리 페이지
import { useState, useEffect } from "react";
import Link from "next/link";
import { MILESTONE_META, RARITY_COLORS, type MilestoneType } from "@/lib/milestones";

interface AchievedMilestone {
  id: string;
  type: string;
  achievedAt: string;
  metadata: Record<string, unknown> | null;
}

export default function MilestonesPage() {
  const [achieved, setAchieved] = useState<AchievedMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    fetch("/api/milestones").then((r) => r.json()).then((j) => {
      if (j.success) setAchieved(j.data);
      setLoading(false);
    });
  }, []);

  async function recheck() {
    setChecking(true);
    const res = await fetch("/api/milestones", { method: "POST" });
    const json = await res.json();
    if (json.success && json.data.newMilestones.length > 0) {
      const fresh = await fetch("/api/milestones").then((r) => r.json());
      if (fresh.success) setAchieved(fresh.data);
    }
    setChecking(false);
  }

  const achievedSet = new Set(achieved.map((m) => m.type));
  const allTypes = Object.keys(MILESTONE_META) as MilestoneType[];

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm">← 대시보드</Link>
          <h1 className="text-base font-semibold text-white">마일스톤</h1>
        </div>
        <button onClick={recheck} disabled={checking}
          className="text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 disabled:opacity-40 px-3 py-1.5 rounded-lg transition-colors">
          {checking ? "체크 중..." : "↻ 동기화"}
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-gray-500">
            달성 <span className="text-white font-semibold">{achieved.length}</span> / {allTypes.length}
          </p>
          {/* 진행도 바 */}
          <div className="w-48 bg-gray-800 rounded-full h-2">
            <div className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${(achieved.length / allTypes.length) * 100}%` }} />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[...Array(9)].map((_, i) => <div key={i} className="animate-pulse bg-gray-800 rounded-xl h-32" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {allTypes.map((type) => {
              const meta = MILESTONE_META[type];
              const done = achievedSet.has(type);
              const record = achieved.find((m) => m.type === type);
              const colorCls = RARITY_COLORS[meta.rarity];

              return (
                <div key={type}
                  className={`rounded-xl p-4 border transition-all ${
                    done
                      ? `bg-gray-900 ${colorCls}`
                      : "bg-gray-900/50 border-gray-800 opacity-40 grayscale"
                  }`}>
                  <div className="text-3xl mb-2">{meta.icon}</div>
                  <p className="text-sm font-semibold text-white">{meta.label}</p>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{meta.description}</p>
                  {done && record && (
                    <p className="text-xs mt-2 font-medium" style={{ color: "inherit" }}>
                      {fmtDate(record.achievedAt)} 달성
                    </p>
                  )}
                  {!done && (
                    <p className="text-xs mt-2 text-gray-600">미달성</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
