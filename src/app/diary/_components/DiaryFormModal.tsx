'use client';
// 일기 작성/수정 모달
import { useState, useEffect } from "react";

export const MOODS = [
  { value: "calm",       label: "평정",  emoji: "😌" },
  { value: "anxious",    label: "불안",  emoji: "😰" },
  { value: "confident",  label: "자신감", emoji: "😎" },
  { value: "fearful",    label: "공포",  emoji: "😨" },
  { value: "greedy",     label: "탐욕",  emoji: "🤑" },
  { value: "frustrated", label: "좌절",  emoji: "😤" },
  { value: "tired",      label: "피곤",  emoji: "😴" },
] as const;

export type MoodValue = typeof MOODS[number]['value'];

interface Props {
  onClose: () => void;
  onSave: (data: { content: string; mood: string | null; tags: string[] }) => Promise<void>;
  initial?: { content: string; mood: string | null; tags: string[] };
}

export default function DiaryFormModal({ onClose, onSave, initial }: Props) {
  const [content, setContent] = useState(initial?.content ?? "");
  const [mood, setMood]       = useState<string | null>(initial?.mood ?? null);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags]       = useState<string[]>(initial?.tags ?? []);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const addTag = (tag: string) => {
    const t = tag.trim().replace(/\s+/g, "_");
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); }
    if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try { await onSave({ content, mood, tags }); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-white font-semibold">{initial ? "일기 수정" : "새 일기"}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl transition-colors">✕</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Mood */}
          <div>
            <p className="text-xs text-gray-400 mb-2">지금 기분</p>
            <div className="flex flex-wrap gap-2">
              {MOODS.map(m => (
                <button key={m.value} onClick={() => setMood(mood === m.value ? null : m.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    mood === m.value
                      ? 'bg-green-500/20 border-green-500 text-green-300'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}>
                  <span>{m.emoji}</span> {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            <p className="text-xs text-gray-400 mb-2">내용</p>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="오늘 시장은 어땠나요? 매매 중 어떤 감정을 느꼈나요?"
              rows={5}
              autoFocus
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 resize-none focus:outline-none focus:border-green-500 transition-colors text-sm leading-relaxed"
            />
          </div>

          {/* Tags */}
          <div>
            <p className="text-xs text-gray-400 mb-2">태그 (Enter 또는 쉼표로 추가)</p>
            <div className="flex flex-wrap gap-1.5 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 min-h-[42px] focus-within:border-green-500 transition-colors">
              {tags.map(t => (
                <span key={t} className="flex items-center gap-1 bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded-full">
                  #{t}
                  <button onClick={() => setTags(tags.filter(x => x !== t))} className="text-gray-500 hover:text-white ml-0.5">×</button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
                placeholder={tags.length === 0 ? "연속익절, 큰손실후, 뉴스반응..." : ""}
                className="flex-1 min-w-[100px] bg-transparent text-white text-sm outline-none placeholder-gray-600"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-6 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-gray-800 text-gray-300 text-sm font-medium hover:bg-gray-700 transition-colors">
            취소
          </button>
          <button onClick={handleSubmit} disabled={!content.trim() || saving}
            className="flex-1 py-2.5 rounded-xl bg-green-500 hover:bg-green-400 disabled:opacity-40 text-black text-sm font-semibold transition-colors">
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
