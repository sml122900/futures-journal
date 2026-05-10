'use client';
// 대시보드 마일스톤 쇼케이스 위젯 (최근 5개 + 진행도)
import { useState, useEffect } from "react";
import Link from "next/link";
import { MILESTONE_META, type MilestoneType } from "@/lib/milestones";

interface Achievement {
  id: string;
  type: string;
  achievedAt: string;
}

const TOTAL = Object.keys(MILESTONE_META).length;

export default function MilestoneShowcase() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/milestones").then((r) => r.json()).then((j) => {
      if (j.success) setAchievements(j.data);
      setLoaded(true);
    });
  }, []);

  if (!loaded || achievements.length === 0) return null;

  const recent = achievements.slice(0, 5);
  const progress = Math.round((achievements.length / TOTAL) * 100);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-300">🏆 마일스톤</h3>
        <Link href="/milestones" className="text-xs text-gray-500 hover:text-gray-300">
          전체 보기 →
        </Link>
      </div>

      {/* 진행도 */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>{achievements.length} / {TOTAL} 달성</span>
          <span>{progress}%</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-1.5">
          <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* 최근 달성 5개 */}
      <div className="space-y-1.5">
        {recent.map((m) => {
          const meta = MILESTONE_META[m.type as MilestoneType];
          if (!meta) return null;
          return (
            <div key={m.id} className="flex items-center gap-2">
              <span className="text-base">{meta.icon}</span>
              <span className="text-xs text-gray-300 flex-1">{meta.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
