'use client';
import { useState } from "react";

export interface MemoSaveData {
  reason: string;
  exitReason: string;
  psych: string;
  external: string;
  text: string;
}

interface Field { key: keyof MemoSaveData; label: string; placeholder: string; rows: number; }

const FIELDS: Field[] = [
  { key: 'reason',     label: '진입 이유',  placeholder: '진입 근거, 시그널, 패턴 등', rows: 3 },
  { key: 'exitReason', label: '청산 이유',  placeholder: '청산 근거, 목표가 도달, 손절 이유 등', rows: 3 },
  { key: 'psych',      label: '심리 상태',  placeholder: '진입 시 심리 상태, 감정 등', rows: 2 },
  { key: 'external',   label: '외부 변수',  placeholder: '뉴스, 매크로 이슈, 컨디션 등', rows: 2 },
  { key: 'text',       label: '자유 메모',  placeholder: '반성, 개선점, 기타 메모...', rows: 4 },
];

interface Props {
  id: string;
  infoLine: string;
  title?: string;
  existing?: MemoSaveData;
  onSave: (d: MemoSaveData) => Promise<void>;
  onClose: () => void;
}

export default function MemoModal({ id: _id, infoLine, title = '포지션 메모', existing, onSave, onClose }: Props) {
  const [data, setData] = useState<MemoSaveData>({
    reason:     existing?.reason     ?? '',
    exitReason: existing?.exitReason ?? '',
    psych:      existing?.psych      ?? '',
    external:   existing?.external   ?? '',
    text:       existing?.text       ?? '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof MemoSaveData) => (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    setData(prev => ({ ...prev, [k]: e.target.value }));

  async function handleSave() {
    setSaving(true);
    await onSave(data);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center px-4 py-6"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white px-1 rounded hover:bg-gray-800 transition-colors text-xl leading-none">✕</button>
        </div>

        {/* Info */}
        <div className="px-6 pt-4 shrink-0">
          <div className="bg-gray-800 rounded-lg px-3 py-2 text-xs text-gray-400 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: infoLine }} />
        </div>

        {/* Fields */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {FIELDS.map(({ key, label, placeholder, rows }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">{label}</label>
              <textarea
                value={data[key]}
                onChange={set(key)}
                rows={rows}
                placeholder={placeholder}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white resize-y outline-none focus:border-green-500 transition-colors placeholder-gray-600"
              />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 border-t border-gray-800 shrink-0">
          <button onClick={handleSave} disabled={saving}
            className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold text-sm px-6 py-2 rounded-lg transition-colors">
            {saving ? '저장 중...' : '저장'}
          </button>
          <button onClick={onClose}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-6 py-2 rounded-lg transition-colors">
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
