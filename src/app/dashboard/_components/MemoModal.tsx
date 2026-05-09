'use client';
import { useState, useEffect, useRef } from "react";

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

const MODELS = [
  { id: "gemini-2.0-flash-lite", label: "Gemini Flash-Lite" },
  { id: "gemini-2.0-flash",      label: "Gemini Flash" },
  { id: "gemini-1.5-pro",        label: "Gemini Pro" },
  { id: "claude-sonnet-4-6",     label: "Claude Sonnet" },
  { id: "claude-opus-4-7",       label: "Claude Opus" },
];

type VoiceState = 'idle' | 'recording' | 'processing';

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

  // 음성 메모 상태
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [aiModel, setAiModel] = useState("gemini-2.0-flash");
  const [aiError, setAiError] = useState('');
  const [supported, setSupported] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // 기본 모델을 localStorage에서 로드
  useEffect(() => {
    const saved = localStorage.getItem("ai_model");
    if (saved && MODELS.some(m => m.id === saved)) setAiModel(saved);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) setSupported(false);
  }, []);

  function startRecording() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: any = new SR();
    rec.lang = 'ko-KR';
    rec.continuous = true;
    rec.interimResults = true;

    let finalText = '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim = r[0].transcript;
      }
      setTranscript(finalText + interim);
    };
    rec.onerror = () => {
      setVoiceState('idle');
    };
    recognitionRef.current = rec;
    rec.start();
    setTranscript('');
    setAiError('');
    setVoiceState('recording');
  }

  function stopRecording() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setVoiceState('idle');
  }

  async function runAiStructure() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (!transcript.trim()) { setVoiceState('idle'); return; }

    setVoiceState('processing');
    setAiError('');

    const positionContext = infoLine.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    try {
      const res = await fetch("/api/ai/structure-memo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, model: aiModel, positionContext }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setData(prev => {
          const next = { ...prev };
          const d = json.data as Partial<MemoSaveData>;
          (Object.keys(d) as (keyof MemoSaveData)[]).forEach(k => {
            if (d[k]) next[k] = prev[k] ? prev[k] + '\n' + d[k] : d[k]!;
          });
          return next;
        });
        setTranscript('');
        setVoiceState('idle');
      } else if (json.message === "INSUFFICIENT_CREDITS") {
        setAiError(`INSUFFICIENT_CREDITS:${json.data?.current ?? 0}:${json.data?.required ?? 0}`);
        setVoiceState('idle');
      } else {
        setAiError(json.message || "AI 처리 실패");
        setVoiceState('idle');
      }
    } catch {
      setAiError("네트워크 오류");
      setVoiceState('idle');
    }
  }

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

        {/* 음성 메모 섹션 */}
        <div className="px-6 pt-4 shrink-0">
          <div className="border border-gray-700 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2">
              {/* 녹음 버튼 */}
              {voiceState === 'idle' && (
                <button
                  onClick={supported ? startRecording : undefined}
                  disabled={!supported}
                  className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 text-xs px-3 py-1.5 rounded-lg transition-colors border border-gray-600"
                >
                  🎤 {supported ? '음성으로 작성' : '미지원 브라우저'}
                </button>
              )}
              {voiceState === 'recording' && (
                <button onClick={runAiStructure}
                  className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-1.5 rounded-lg transition-colors animate-pulse">
                  ⏹ 중지 후 AI 정리
                </button>
              )}
              {voiceState === 'processing' && (
                <span className="text-xs text-gray-400 px-3 py-1.5">AI 처리 중...</span>
              )}

              {/* 모델 드롭다운 */}
              <select
                value={aiModel}
                onChange={e => { setAiModel(e.target.value); localStorage.setItem("ai_model", e.target.value); }}
                className="ml-auto bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-2 py-1.5 outline-none focus:border-green-500"
              >
                {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>

            {/* 인식 중 텍스트 */}
            {voiceState === 'recording' && (
              <div className="bg-gray-800 rounded-lg px-3 py-2 text-xs text-gray-300 min-h-[2.5rem]">
                {transcript || <span className="text-gray-600">말씀하세요...</span>}
              </div>
            )}

            {/* 에러 */}
            {aiError && (
              aiError.startsWith("INSUFFICIENT_CREDITS") ? (
                <p className="text-xs text-yellow-400">
                  크레딧이 부족합니다 (보유: {aiError.split(":")[1]}c / 필요: {aiError.split(":")[2]}c){" "}
                  <a href="/payments" className="underline hover:text-yellow-300">충전하기 →</a>
                </p>
              ) : (
                <p className="text-xs text-red-400">{aiError}</p>
              )
            )}

            {!supported && (
              <p className="text-xs text-gray-600">Chrome 또는 Edge에서 음성 입력이 지원됩니다.</p>
            )}
          </div>
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
