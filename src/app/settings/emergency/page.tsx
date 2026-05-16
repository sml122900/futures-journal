"use client";
// Emergency Brake 설정 페이지
import { useState, useEffect } from "react";

interface EmergencySetting {
  enabled: boolean;
  level1Threshold: number;
  level2Threshold: number;
  level3Threshold: number;
  activeHoursOnly: boolean;
  activeHourStart: number;
  activeHourEnd: number;
  customMessage: string | null;
  pausedUntil: string | null;
  pauseReason: string | null;
}

const DEFAULT: EmergencySetting = {
  enabled: true,
  level1Threshold: 1.5,
  level2Threshold: 2.0,
  level3Threshold: 5.0,
  activeHoursOnly: false,
  activeHourStart: 0,
  activeHourEnd: 23,
  customMessage: null,
  pausedUntil: null,
  pauseReason: null,
};

const PAUSE_OPTIONS = [
  { label: "15분", minutes: 15 },
  { label: "1시간", minutes: 60 },
  { label: "24시간", minutes: 1440 },
];

export default function EmergencySettingsPage() {
  const [setting, setSetting] = useState<EmergencySetting>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [pauseReason, setPauseReason] = useState("");

  useEffect(() => {
    fetch("/api/settings/emergency")
      .then((r) => r.json())
      .then((d) => { if (d.setting) setSetting(d.setting); })
      .finally(() => setLoading(false));
  }, []);

  async function save(patch: Partial<EmergencySetting>) {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings/emergency", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (data.setting) { setSetting(data.setting); setSaved(true); }
    } finally {
      setSaving(false);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  async function handlePause(minutes: number) {
    if (!pauseReason.trim()) {
      alert("일시 비활성화 사유를 입력해주세요.");
      return;
    }
    await save({
      pausedUntil: new Date(Date.now() + minutes * 60_000).toISOString(),
      pauseReason: pauseReason,
    });
    setPauseReason("");
  }

  async function handleUnpause() {
    await save({ pausedUntil: null, pauseReason: null });
  }

  if (loading) return <div className="p-8 text-gray-500">불러오는 중...</div>;

  const isPaused = setting.pausedUntil && new Date(setting.pausedUntil) > new Date();

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Emergency Brake 설정</h1>
        <p className="text-sm text-gray-500 mt-1">
          뇌동매매 감지 시 텔레그램으로 강력한 경고를 발송합니다.
        </p>
      </div>

      {saved && (
        <div className="px-4 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm">
          ✅ 저장되었습니다.
        </div>
      )}

      {/* 섹션 1: 활성화 */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Emergency Brake 사용</p>
            <p className="text-xs text-gray-500 mt-0.5">평소보다 큰 사이즈 진입 시 텔레그램 경고 발송</p>
          </div>
          <button
            onClick={() => save({ enabled: !setting.enabled })}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${setting.enabled ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"}`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${setting.enabled ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
      </section>

      {/* 섹션 2: 트리거 임계값 */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <h2 className="font-medium">트리거 임계값</h2>
        {[
          { key: "level1Threshold" as const, label: "Level 1 (주의)", color: "text-yellow-600", desc: "1회 경고" },
          { key: "level2Threshold" as const, label: "Level 2 (경고)", color: "text-orange-600", desc: "3회 경고" },
          { key: "level3Threshold" as const, label: "Level 3 (긴급)", color: "text-red-600", desc: "6회 + 5분 후속" },
        ].map(({ key, label, color, desc }) => (
          <div key={key} className="flex items-center gap-4">
            <div className="w-36">
              <p className={`text-sm font-medium ${color}`}>{label}</p>
              <p className="text-xs text-gray-400">{desc}</p>
            </div>
            <div className="flex-1">
              <input
                type="range"
                min={1.0} max={10.0} step={0.5}
                value={setting[key]}
                onChange={(e) => setSetting((s) => ({ ...s, [key]: parseFloat(e.target.value) }))}
                className="w-full"
              />
            </div>
            <div className="w-16 text-right">
              <span className="font-mono font-medium">{setting[key].toFixed(1)}x</span>
            </div>
          </div>
        ))}
        <button
          onClick={() => save({ level1Threshold: setting.level1Threshold, level2Threshold: setting.level2Threshold, level3Threshold: setting.level3Threshold })}
          disabled={saving}
          className="mt-2 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-50"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </section>

      {/* 섹션 3: 작동 시간대 */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">특정 시간대만 작동</h2>
          <button
            onClick={() => save({ activeHoursOnly: !setting.activeHoursOnly })}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${setting.activeHoursOnly ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"}`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${setting.activeHoursOnly ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
        {setting.activeHoursOnly && (
          <div className="flex items-center gap-3 text-sm">
            <input type="number" min={0} max={23} value={setting.activeHourStart}
              onChange={(e) => setSetting((s) => ({ ...s, activeHourStart: parseInt(e.target.value) }))}
              className="w-16 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-transparent"
            />
            <span className="text-gray-500">시 ~</span>
            <input type="number" min={0} max={23} value={setting.activeHourEnd}
              onChange={(e) => setSetting((s) => ({ ...s, activeHourEnd: parseInt(e.target.value) }))}
              className="w-16 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-transparent"
            />
            <span className="text-gray-500">시</span>
            <button
              onClick={() => save({ activeHourStart: setting.activeHourStart, activeHourEnd: setting.activeHourEnd })}
              disabled={saving}
              className="px-3 py-1 rounded bg-blue-600 text-white text-xs disabled:opacity-50"
            >저장</button>
          </div>
        )}
      </section>

      {/* 섹션 4: 강제 문장 */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-2">
        <h2 className="font-medium">나만의 경고 문구 (선택)</h2>
        <p className="text-xs text-gray-500">비워두면 기본 문구 사용: "원칙을 지켜야 살아남는다"</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={setting.customMessage ?? ""}
            onChange={(e) => setSetting((s) => ({ ...s, customMessage: e.target.value }))}
            placeholder="나만의 경고 문구를 입력하세요"
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => save({ customMessage: setting.customMessage })}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-50"
          >저장</button>
        </div>
      </section>

      {/* 섹션 5: 일시 비활성화 */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <h2 className="font-medium">일시 비활성화</h2>
        {isPaused ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-amber-700 dark:text-amber-400">
                ⏸ {new Date(setting.pausedUntil!).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}까지 비활성화
              </p>
              {setting.pauseReason && (
                <p className="text-xs text-gray-500 mt-0.5">사유: {setting.pauseReason}</p>
              )}
            </div>
            <button
              onClick={handleUnpause}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
            >재활성화</button>
          </div>
        ) : (
          <>
            <input
              type="text"
              value={pauseReason}
              onChange={(e) => setPauseReason(e.target.value)}
              placeholder="비활성화 사유 (필수)"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              {PAUSE_OPTIONS.map(({ label, minutes }) => (
                <button
                  key={minutes}
                  onClick={() => handlePause(minutes)}
                  disabled={saving}
                  className="flex-1 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
