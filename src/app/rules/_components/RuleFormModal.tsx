'use client';
// 룰 추가/수정 모달 (2단계: 타입 선택 → 설정 입력)
import { useState } from "react";
import { RULE_META, type RuleType } from "@/lib/rules-types";

interface RuleData {
  id?: string;
  type: RuleType;
  config: Record<string, unknown>;
  enabled: boolean;
}

interface Props {
  existing?: RuleData;
  onSave: () => void;
  onClose: () => void;
}

const RULE_ICONS: Record<RuleType, string> = {
  time_block:   "🕐",
  cooldown:     "⏸",
  daily_limit:  "📉",
  psych_block:  "🧠",
  liq_distance: "⚡",
  loss_streak:  "🔥",
};

const RULE_TYPES: RuleType[] = ["time_block", "cooldown", "daily_limit", "psych_block", "liq_distance", "loss_streak"];

const PSYCH_PRESETS = ["FOMO", "복수심리", "과신", "초조함", "공포", "지루함", "흥분", "피로"];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function defaultConfig(type: RuleType): Record<string, unknown> {
  switch (type) {
    case "time_block":   return { hours: [] };
    case "cooldown":     return { minutes: 30, after: "loss" };
    case "daily_limit":  return { lossPercent: 5 };
    case "psych_block":  return { blockedStates: [] };
    case "liq_distance": return { minPercent: 5 };
    case "loss_streak":  return { count: 3, restMinutes: 60 };
  }
}

/** 룰 config 한 줄 요약 */
export function ruleConfigSummary(type: RuleType, config: Record<string, unknown>): string {
  switch (type) {
    case "time_block": {
      const hours = (config.hours as number[]) ?? [];
      return hours.length ? `${hours.join("시, ")}시 차단` : "시간 미설정";
    }
    case "cooldown":
      return `${config.after === "loss" ? "손실" : "모든 거래"} 후 ${config.minutes}분`;
    case "daily_limit":
      return `일일 손실 ${config.lossPercent}% 한도`;
    case "psych_block": {
      const s = (config.blockedStates as string[]) ?? [];
      return s.length ? s.join(", ") : "상태 미설정";
    }
    case "liq_distance":
      return `청산가 ${config.minPercent}% 이내`;
    case "loss_streak":
      return `${config.count}연속 손실 후 ${config.restMinutes}분 휴식`;
  }
}

export default function RuleFormModal({ existing, onSave, onClose }: Props) {
  const [step, setStep] = useState<"select" | "configure">(existing ? "configure" : "select");
  const [type, setType] = useState<RuleType>(existing?.type ?? "time_block");
  const [config, setConfig] = useState<Record<string, unknown>>(
    existing?.config ?? defaultConfig(existing?.type ?? "time_block")
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function selectType(t: RuleType) {
    setType(t);
    setConfig(defaultConfig(t));
    setStep("configure");
  }

  function setNum(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setConfig((p) => ({ ...p, [key]: Number(e.target.value) }));
  }

  function toggleHour(h: number) {
    setConfig((p) => {
      const hours = (p.hours as number[]) ?? [];
      return { ...p, hours: hours.includes(h) ? hours.filter((x) => x !== h) : [...hours, h].sort((a, b) => a - b) };
    });
  }

  function togglePsych(s: string) {
    setConfig((p) => {
      const states = (p.blockedStates as string[]) ?? [];
      return { ...p, blockedStates: states.includes(s) ? states.filter((x) => x !== s) : [...states, s] };
    });
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const url   = existing?.id ? `/api/rules/${existing.id}` : "/api/rules";
      const method = existing?.id ? "PUT" : "POST";
      const body = existing?.id ? { config } : { type, config };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) { setError(json.message ?? "저장 실패"); setSaving(false); return; }
      onSave();
    } catch {
      setError("네트워크 오류");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center px-4 py-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <h2 className="text-base font-semibold text-white">
            {existing ? "룰 수정" : step === "select" ? "룰 타입 선택" : "룰 설정"}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none px-1 rounded hover:bg-gray-800">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">
          {/* Step 1: 타입 선택 */}
          {step === "select" && (
            <div className="grid grid-cols-2 gap-3">
              {RULE_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => selectType(t)}
                  className="bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 rounded-xl p-4 text-left transition-colors group"
                >
                  <div className="text-2xl mb-2">{RULE_ICONS[t]}</div>
                  <div className="text-sm font-semibold text-white">{RULE_META[t].label}</div>
                  <div className="text-xs text-gray-500 mt-1 leading-relaxed">{RULE_META[t].description}</div>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: 설정 */}
          {step === "configure" && (
            <div className="space-y-5">
              {/* 선택된 타입 뱃지 */}
              <div className="flex items-center gap-2">
                <span className="text-xl">{RULE_ICONS[type]}</span>
                <span className="text-sm font-semibold text-white">{RULE_META[type].label}</span>
                {!existing && (
                  <button onClick={() => setStep("select")} className="ml-auto text-xs text-gray-500 hover:text-gray-300">
                    ← 변경
                  </button>
                )}
              </div>

              {/* time_block */}
              {type === "time_block" && (
                <div>
                  <label className="text-xs text-gray-400 mb-2 block">차단할 UTC 시간대 (복수 선택)</label>
                  <div className="grid grid-cols-6 gap-1.5">
                    {HOURS.map((h) => (
                      <button
                        key={h}
                        onClick={() => toggleHour(h)}
                        className={`py-1.5 text-xs rounded-lg border transition-colors ${
                          ((config.hours as number[]) ?? []).includes(h)
                            ? "bg-blue-600 border-blue-500 text-white font-medium"
                            : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500"
                        }`}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* cooldown */}
              {type === "cooldown" && (
                <>
                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 block">쿨다운 시간 (분)</label>
                    <input type="number" min={1} max={1440} value={config.minutes as number}
                      onChange={setNum("minutes")}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 block">적용 기준</label>
                    <div className="flex gap-2">
                      {[{ v: "loss", l: "손실 후" }, { v: "any", l: "모든 거래 후" }].map(({ v, l }) => (
                        <button key={v} onClick={() => setConfig((p) => ({ ...p, after: v }))}
                          className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                            config.after === v
                              ? "bg-orange-600 border-orange-500 text-white font-medium"
                              : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500"
                          }`}>{l}</button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* daily_limit */}
              {type === "daily_limit" && (
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">일일 손실 한도 (마진 대비 %)</label>
                  <input type="number" min={1} max={20} step={0.5} value={config.lossPercent as number}
                    onChange={setNum("lossPercent")}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500" />
                  <p className="text-xs text-gray-600 mt-1">예: 5 = 오늘 사용한 마진의 5% 이상 손실 시 경고</p>
                </div>
              )}

              {/* psych_block */}
              {type === "psych_block" && (
                <div>
                  <label className="text-xs text-gray-400 mb-2 block">차단할 심리 상태</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {PSYCH_PRESETS.map((s) => (
                      <button key={s} onClick={() => togglePsych(s)}
                        className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                          ((config.blockedStates as string[]) ?? []).includes(s)
                            ? "bg-purple-600 border-purple-500 text-white"
                            : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500"
                        }`}>{s}</button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-600">메모의 '심리 상태' 필드에 위 단어가 포함되면 감지됩니다.</p>
                </div>
              )}

              {/* liq_distance */}
              {type === "liq_distance" && (
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">청산가 최소 거리 (%)</label>
                  <input type="number" min={1} max={20} step={0.5} value={config.minPercent as number}
                    onChange={setNum("minPercent")}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500" />
                  <p className="text-xs text-gray-600 mt-1">예: 5 = 청산가가 진입가의 5% 이내이면 경고</p>
                </div>
              )}

              {/* loss_streak */}
              {type === "loss_streak" && (
                <>
                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 block">연속 손실 횟수</label>
                    <input type="number" min={2} max={10} value={config.count as number}
                      onChange={setNum("count")}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 block">필수 휴식 시간 (분)</label>
                    <input type="number" min={1} max={1440} value={config.restMinutes as number}
                      onChange={setNum("restMinutes")}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-500" />
                  </div>
                </>
              )}

              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        {step === "configure" && (
          <div className="flex gap-2 px-6 py-4 border-t border-gray-800 shrink-0">
            <button onClick={handleSave} disabled={saving}
              className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold text-sm px-6 py-2 rounded-lg transition-colors">
              {saving ? "저장 중..." : existing ? "수정" : "저장"}
            </button>
            <button onClick={onClose}
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-6 py-2 rounded-lg transition-colors">
              취소
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
