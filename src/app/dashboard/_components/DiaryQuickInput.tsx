'use client';
// 대시보드 빠른 일기 입력 위젯
import { useState } from "react";
import { MOODS } from "@/app/diary/_components/DiaryFormModal";

export default function DiaryQuickInput() {
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState("");
  const [mood, setMood]       = useState<string | null>(null);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/diaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, mood, tags: [] }),
      });
      setContent(""); setMood(null); setExpanded(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl mb-4 overflow-hidden transition-all">
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-800/50 transition-colors"
        >
          <span className="text-gray-600 text-lg">✏️</span>
          <span className="text-gray-500 text-sm flex-1">오늘 시장은 어떻게 보세요?</span>
          {saved && <span className="text-green-400 text-xs">저장됨 ✓</span>}
        </button>
      ) : (
        <div className="p-4 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {MOODS.map(m => (
              <button key={m.value} onClick={() => setMood(mood === m.value ? null : m.value)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                  mood === m.value ? 'bg-green-500/20 border-green-500 text-green-300' : 'bg-gray-800 border-gray-700 text-gray-400'
                }`}>
                {m.emoji} {m.label}
              </button>
            ))}
          </div>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="오늘 시장은 어떻게 보세요?"
            rows={3}
            autoFocus
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white placeholder-gray-600 resize-none focus:outline-none focus:border-green-500 transition-colors text-sm"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => { setExpanded(false); setContent(""); setMood(null); }}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors">
              취소
            </button>
            <button onClick={handleSave} disabled={!content.trim() || saving}
              className="px-4 py-1.5 bg-green-500 hover:bg-green-400 disabled:opacity-40 text-black text-xs font-semibold rounded-lg transition-colors">
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
