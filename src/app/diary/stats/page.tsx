'use client';
// 일기 통계 페이지
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { MOODS } from "../_components/DiaryFormModal";

interface StatsData {
  total: number;
  moodCount: Record<string, number>;
  topTags: [string, number][];
  weeklyFreq: { week: string; count: number }[];
  calendarMap: Record<string, number>;
  moodActivity: Record<string, { diaryCount: number; nearTradeCount: number }>;
}

const MOOD_COLORS: Record<string, string> = {
  calm: "bg-blue-500", anxious: "bg-yellow-500", confident: "bg-green-500",
  fearful: "bg-red-500", greedy: "bg-orange-500", frustrated: "bg-purple-500", tired: "bg-gray-500",
};

export default function DiaryStatsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/diaries/stats")
      .then(r => r.json())
      .then(json => { if (json.success) setStats(json.data); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/diary" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">← 일기</Link>
          <h1 className="text-2xl font-bold text-white">일기 통계</h1>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500 text-sm">불러오는 중...</div>
        ) : !stats || stats.total === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">아직 작성한 일기가 없습니다</p>
            <Link href="/diary" className="text-green-400 text-sm mt-2 inline-block hover:text-green-300">일기 작성하러 가기 →</Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 총 작성 수 */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">총 작성</p>
              <p className="text-3xl font-bold text-white">{stats.total}<span className="text-lg text-gray-400 ml-1">개</span></p>
            </div>

            {/* Mood 분포 */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">기분 분포</p>
              <div className="space-y-2.5">
                {MOODS.map(m => {
                  const count = stats.moodCount[m.value] ?? 0;
                  const pct = stats.total > 0 ? (count / stats.total * 100).toFixed(0) : 0;
                  return (
                    <div key={m.value} className="flex items-center gap-3">
                      <span className="text-base w-5">{m.emoji}</span>
                      <span className="text-sm text-gray-400 w-12">{m.label}</span>
                      <div className="flex-1 bg-gray-800 rounded-full h-2">
                        <div className={`h-2 rounded-full transition-all ${MOOD_COLORS[m.value] ?? 'bg-gray-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-8 text-right">{count > 0 ? `${count}회` : "-"}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 주별 작성 빈도 */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">주별 작성 빈도 (최근 12주)</p>
              <div className="flex items-end gap-1.5 h-24">
                {stats.weeklyFreq.map(({ week, count }) => {
                  const max = Math.max(...stats.weeklyFreq.map(w => w.count), 1);
                  const height = (count / max * 100).toFixed(0);
                  return (
                    <div key={week} className="flex-1 flex flex-col items-center gap-1" title={`${week}: ${count}개`}>
                      <div className="w-full bg-green-500/80 rounded-sm transition-all" style={{ height: `${height}%`, minHeight: count > 0 ? '4px' : '0' }} />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-gray-600">{stats.weeklyFreq[0]?.week?.slice(5) ?? ""}</span>
                <span className="text-xs text-gray-600">{stats.weeklyFreq[stats.weeklyFreq.length - 1]?.week?.slice(5) ?? ""}</span>
              </div>
            </div>

            {/* mood × 거래 활동 매트릭스 */}
            {Object.keys(stats.moodActivity).length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">기분 × 거래 활동 연관성</p>
                <p className="text-xs text-gray-600 mb-3">일기 작성 ±3시간 내 거래 메모가 있었던 비율</p>
                <div className="space-y-2">
                  {MOODS.filter(m => stats.moodActivity[m.value]).map(m => {
                    const act = stats.moodActivity[m.value];
                    const pct = act.diaryCount > 0 ? (act.nearTradeCount / act.diaryCount * 100).toFixed(0) : 0;
                    return (
                      <div key={m.value} className="flex items-center gap-3">
                        <span className="text-base w-5">{m.emoji}</span>
                        <span className="text-sm text-gray-400 w-12">{m.label}</span>
                        <div className="flex-1 bg-gray-800 rounded-full h-2">
                          <div className="h-2 rounded-full bg-blue-500/70 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 w-12 text-right">{pct}%</span>
                        <span className="text-xs text-gray-600 w-12 text-right">{act.diaryCount}회 작성</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 365일 캘린더 히트맵 */}
            {Object.keys(stats.calendarMap).length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">작성 캘린더 (최근 52주)</p>
                <div className="flex gap-0.5 overflow-x-auto pb-1">
                  {(() => {
                    const today = new Date();
                    const weeks: React.JSX.Element[] = [];
                    for (let w = 51; w >= 0; w--) {
                      const cells: React.JSX.Element[] = [];
                      for (let d = 0; d < 7; d++) {
                        const date = new Date(today);
                        date.setDate(today.getDate() - (w * 7 + (6 - d)));
                        const key = date.toISOString().slice(0, 10);
                        const count = stats.calendarMap[key] ?? 0;
                        cells.push(
                          <div key={d} title={`${key}: ${count}개`}
                            className={`w-3 h-3 rounded-sm ${
                              count === 0 ? 'bg-gray-800' :
                              count === 1 ? 'bg-green-800' :
                              count === 2 ? 'bg-green-600' : 'bg-green-400'
                            }`} />
                        );
                      }
                      weeks.push(<div key={w} className="flex flex-col gap-0.5">{cells}</div>);
                    }
                    return weeks;
                  })()}
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-600">
                  <span>적음</span>
                  {['bg-gray-800','bg-green-800','bg-green-600','bg-green-400'].map((c,i) => (
                    <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
                  ))}
                  <span>많음</span>
                </div>
              </div>
            )}

            {/* 인기 태그 */}
            {stats.topTags.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">자주 쓴 태그</p>
                <div className="flex flex-wrap gap-2">
                  {stats.topTags.map(([tag, count]) => (
                    <span key={tag} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 rounded-full text-sm text-gray-300">
                      <span className="text-gray-500">#</span>{tag}
                      <span className="text-xs text-gray-600 ml-0.5">{count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
