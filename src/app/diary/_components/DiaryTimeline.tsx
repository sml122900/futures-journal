'use client';
// 일기 타임라인 컴포넌트
import { useState, useEffect } from "react";
import { MOODS } from "./DiaryFormModal";
import DiaryFormModal from "./DiaryFormModal";

interface RelatedMemo { positionId: string; reason: string; exitReason: string; psych: string; updatedAt: string; }

function RelatedTrades({ diaryId }: { diaryId: string }) {
  const [memos, setMemos] = useState<RelatedMemo[] | null>(null);
  const [open, setOpen]   = useState(false);

  useEffect(() => {
    if (!open || memos !== null) return;
    fetch(`/api/diaries/${diaryId}/related-trades`)
      .then(r => r.json())
      .then(json => setMemos(json.success ? json.data : []));
  }, [open, diaryId, memos]);

  return (
    <div className="mt-3 border-t border-gray-800 pt-2">
      <button onClick={() => setOpen(v => !v)}
        className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
        {open ? "▾" : "▸"} 이 시점의 거래 메모
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          {memos === null ? (
            <p className="text-xs text-gray-600">로딩 중...</p>
          ) : memos.length === 0 ? (
            <p className="text-xs text-gray-600">±3시간 내 거래 메모 없음</p>
          ) : memos.map((m) => (
            <div key={m.positionId} className="bg-gray-800 rounded-lg px-3 py-2 text-xs">
              <div className="text-gray-400 truncate">진입: {m.reason || "—"} | 청산: {m.exitReason || "—"}</div>
              {m.psych && <div className="text-gray-500 mt-0.5">심리: {m.psych}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface Diary {
  id: string;
  content: string;
  mood: string | null;
  tags: string[];
  createdAt: string;
}

interface Props {
  diaries: Diary[];
  onUpdate: (id: string, data: { content: string; mood: string | null; tags: string[] }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function groupByDate(diaries: Diary[]) {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const groups: { label: string; items: Diary[] }[] = [];
  const map = new Map<string, Diary[]>();

  for (const d of diaries) {
    const day = new Date(d.createdAt).toDateString();
    const label = day === today ? "오늘" : day === yesterday ? "어제" : new Date(d.createdAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
    if (!map.has(label)) { map.set(label, []); groups.push({ label, items: map.get(label)! }); }
    map.get(label)!.push(d);
  }
  return groups;
}

function moodEmoji(mood: string | null) {
  return MOODS.find(m => m.value === mood)?.emoji ?? "";
}

function moodLabel(mood: string | null) {
  return MOODS.find(m => m.value === mood)?.label ?? "";
}

export default function DiaryTimeline({ diaries, onUpdate, onDelete }: Props) {
  const [editTarget, setEditTarget] = useState<Diary | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (diaries.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-4xl mb-3">📝</div>
        <p className="text-gray-400">아직 작성한 일기가 없습니다</p>
        <p className="text-gray-600 text-sm mt-1">오늘 매매 후 기분을 한 줄 남겨보세요</p>
      </div>
    );
  }

  const groups = groupByDate(diaries);

  return (
    <>
      <div className="space-y-6">
        {groups.map(({ label, items }) => (
          <div key={label}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{label}</p>
            <div className="space-y-3">
              {items.map(diary => (
                <div key={diary.id} className="group bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-gray-500 text-xs">
                        {new Date(diary.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {diary.mood && (
                        <span className="text-sm" title={moodLabel(diary.mood)}>{moodEmoji(diary.mood)}</span>
                      )}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 flex gap-1.5 transition-opacity shrink-0">
                      <button onClick={() => setEditTarget(diary)}
                        className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded-lg hover:bg-gray-800 transition-colors">
                        수정
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm("이 일기를 삭제할까요?")) return;
                          setDeletingId(diary.id);
                          await onDelete(diary.id);
                          setDeletingId(null);
                        }}
                        disabled={deletingId === diary.id}
                        className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded-lg hover:bg-red-900/30 transition-colors disabled:opacity-50">
                        삭제
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-200 text-sm leading-relaxed mt-2 whitespace-pre-wrap">{diary.content}</p>
                  {diary.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {diary.tags.map(t => (
                        <span key={t} className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">#{t}</span>
                      ))}
                    </div>
                  )}
                  <RelatedTrades diaryId={diary.id} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {editTarget && (
        <DiaryFormModal
          initial={{ content: editTarget.content, mood: editTarget.mood, tags: editTarget.tags }}
          onClose={() => setEditTarget(null)}
          onSave={async (data) => {
            await onUpdate(editTarget.id, data);
            setEditTarget(null);
          }}
        />
      )}
    </>
  );
}
