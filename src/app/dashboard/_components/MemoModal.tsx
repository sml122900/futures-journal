'use client';
import { useState } from "react";

const REASON_OPTIONS = ['EMA 신호', '스탑헌팅', '지지/저항', '추세추종', '뉴스', '기타'];
const PSYCH_OPTIONS  = ['안정', '불안', 'FOMO', '자신감 과잉', '복수심리', '취침 전'];
const EXT_OPTIONS    = ['없음', '컨디션 불량', '뉴스 이슈', '외부 일정'];

export interface MemoSaveData { reason: string; psych: string; external: string; text: string; }

interface Props {
  id: string;
  infoLine: string;
  existing?: MemoSaveData;
  onSave: (d: MemoSaveData) => Promise<void>;
  onClose: () => void;
}

function Pills({ opts, val, onChange }: { opts: string[]; val: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {opts.map(o => (
        <button key={o} type="button" onClick={() => onChange(val === o ? '' : o)}
          className={`px-3 py-1 rounded-full text-xs border transition-colors ${val === o ? 'bg-green-500 text-black border-green-500' : 'border-gray-700 text-gray-400 hover:border-green-500 hover:text-white'}`}>
          {o}
        </button>
      ))}
    </div>
  );
}

export default function MemoModal({ id: _id, infoLine, existing, onSave, onClose }: Props) {
  const [reason,   setReason]   = useState(existing?.reason   || '');
  const [psych,    setPsych]    = useState(existing?.psych    || '');
  const [external, setExternal] = useState(existing?.external || '');
  const [text,     setText]     = useState(existing?.text     || '');
  const [saving,   setSaving]   = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave({ reason, psych, external, text });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">포지션 메모</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white px-1 rounded hover:bg-gray-800 transition-colors text-xl">✕</button>
        </div>
        <div className="bg-gray-800 rounded-lg px-3 py-2 mb-5 text-xs text-gray-400 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: infoLine }} />
        <div className="space-y-4">
          <div>
            <p className="text-xs text-gray-400 font-medium mb-2">진입 이유</p>
            <Pills opts={REASON_OPTIONS} val={reason} onChange={setReason} />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium mb-2">심리 상태</p>
            <Pills opts={PSYCH_OPTIONS} val={psych} onChange={setPsych} />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium mb-2">외부 변수</p>
            <Pills opts={EXT_OPTIONS} val={external} onChange={setExternal} />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium mb-2">자유 메모</p>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
              placeholder="진입 근거, 반성, 개선점..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white resize-y outline-none focus:border-green-500 transition-colors" />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={handleSave} disabled={saving}
            className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold text-sm px-5 py-2 rounded-lg transition-colors">
            {saving ? '저장 중...' : '저장'}
          </button>
          <button onClick={onClose}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-5 py-2 rounded-lg transition-colors">
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
