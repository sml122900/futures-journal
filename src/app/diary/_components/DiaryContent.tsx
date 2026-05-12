'use client';
// 심리 일기 메인 컨텐츠 컴포넌트
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import DiaryFormModal, { MOODS } from "./DiaryFormModal";
import DiaryTimeline from "./DiaryTimeline";

interface Diary {
  id: string;
  content: string;
  mood: string | null;
  tags: string[];
  createdAt: string;
}

export default function DiaryContent() {
  const [diaries, setDiaries]     = useState<Diary[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [moodFilter, setMoodFilter] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (cursor?: string, mood?: string | null) => {
    const params = new URLSearchParams();
    if (cursor) params.set("cursor", cursor);
    if (mood)   params.set("mood", mood);
    const res  = await fetch(`/api/diaries?${params}`);
    const json = await res.json();
    return json.success ? json.data : { diaries: [], nextCursor: null };
  }, []);

  useEffect(() => {
    setLoading(true);
    load(undefined, moodFilter).then(({ diaries, nextCursor }) => {
      setDiaries(diaries);
      setNextCursor(nextCursor);
    }).finally(() => setLoading(false));
  }, [load, moodFilter]);

  const handleCreate = async (data: { content: string; mood: string | null; tags: string[] }) => {
    const res  = await fetch("/api/diaries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const json = await res.json();
    if (json.success) {
      setDiaries(prev => [json.data, ...prev]);
      setShowForm(false);
    }
  };

  const handleUpdate = async (id: string, data: { content: string; mood: string | null; tags: string[] }) => {
    const res  = await fetch(`/api/diaries/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const json = await res.json();
    if (json.success) {
      setDiaries(prev => prev.map(d => d.id === id ? json.data : d));
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/diaries/${id}`, { method: "DELETE" });
    if (res.ok) setDiaries(prev => prev.filter(d => d.id !== id));
  };

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const { diaries: more, nextCursor: nc } = await load(nextCursor, moodFilter);
    setDiaries(prev => [...prev, ...more]);
    setNextCursor(nc);
    setLoadingMore(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href="/dashboard" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">← 대시보드</Link>
            </div>
            <h1 className="text-2xl font-bold text-white">매매 일기</h1>
          </div>
          <div className="flex gap-2">
            <Link href="/diary/stats" className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-300 hover:text-white hover:border-gray-600 transition-colors">
              통계
            </Link>
            <button onClick={() => setShowForm(true)}
              className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-400 text-black text-sm font-semibold transition-colors">
              + 새 일기
            </button>
          </div>
        </div>

        {/* Mood filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button onClick={() => setMoodFilter(null)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              !moodFilter ? 'bg-green-500/20 border-green-500 text-green-300' : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'
            }`}>
            전체
          </button>
          {MOODS.map(m => (
            <button key={m.value} onClick={() => setMoodFilter(moodFilter === m.value ? null : m.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                moodFilter === m.value ? 'bg-green-500/20 border-green-500 text-green-300' : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'
              }`}>
              {m.emoji} {m.label}
            </button>
          ))}
        </div>

        {/* Timeline */}
        {loading ? (
          <div className="text-center py-12 text-gray-500 text-sm">불러오는 중...</div>
        ) : (
          <>
            <DiaryTimeline diaries={diaries} onUpdate={handleUpdate} onDelete={handleDelete} />
            {nextCursor && (
              <div className="text-center mt-6">
                <button onClick={loadMore} disabled={loadingMore}
                  className="px-5 py-2 rounded-xl bg-gray-800 border border-gray-700 text-sm text-gray-300 hover:text-white hover:border-gray-600 disabled:opacity-50 transition-colors">
                  {loadingMore ? "불러오는 중..." : "더 보기"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showForm && (
        <DiaryFormModal onClose={() => setShowForm(false)} onSave={handleCreate} />
      )}
    </div>
  );
}
