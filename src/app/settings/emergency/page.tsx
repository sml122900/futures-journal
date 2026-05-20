"use client";
// Emergency Brake 설정 — 6개 사용자 정의 트리거 카드 UI
import { useState, useEffect, useCallback } from "react";

// ─── 타입 ──────────────────────────────────────────────────────

interface TriggerSettings {
  maxTotalPositionEnabled: boolean;
  maxTotalPositionUsdt: number | null;
  maxSingleLossEnabled: boolean;
  maxSingleLossUsdt: number | null;
  minIntervalEnabled: boolean;
  minIntervalMinutes: number | null;
  lastPositionEntryAt: string | null;
  maxSingleSizeEnabled: boolean;
  maxSingleSizeUsdt: number | null;
  forceSentence: string;
}

interface NoTradeWindow {
  id: string;
  startAt: string;
  endAt: string;
  reason: string | null;
}

interface RecurringRule {
  id: string;
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  reason: string | null;
  enabled: boolean;
}

interface BlockingStatus {
  isBlocking: boolean;
  reasons: string[];
  forceSentence: string;
}

// ─── 헬퍼 ──────────────────────────────────────────────────────

const DEFAULT: TriggerSettings = {
  maxTotalPositionEnabled: false,
  maxTotalPositionUsdt: null,
  maxSingleLossEnabled: false,
  maxSingleLossUsdt: null,
  minIntervalEnabled: false,
  minIntervalMinutes: null,
  lastPositionEntryAt: null,
  maxSingleSizeEnabled: false,
  maxSingleSizeUsdt: null,
  forceSentence: "나는 충동이 아닌 원칙으로 매매할 것을 맹세한다",
};

function fmtKST(iso: string): string {
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 3600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())} ${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}`;
}

function padT(n: number) { return String(n).padStart(2, "0"); }

// ─── 공통 카드 ─────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm p-5 space-y-4">
      {children}
    </div>
  );
}

function CardHeader({ icon, title, enabled, onToggle }: {
  icon: string; title: string; enabled: boolean; onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <span className="font-semibold text-gray-800 dark:text-gray-100">{title}</span>
      </div>
      <button
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          enabled ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
        }`}
      >
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`} />
      </button>
    </div>
  );
}

function StatusBadge({ isActive, label }: { isActive: boolean; label: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
      isActive
        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
        : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
    }`}>
      {label}
    </span>
  );
}

function SaveBtn({ saving, onSave }: { saving: boolean; onSave: () => void }) {
  return (
    <button
      onClick={onSave}
      disabled={saving}
      className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50"
    >
      {saving ? "저장 중..." : "저장"}
    </button>
  );
}

// ─── 메인 페이지 ───────────────────────────────────────────────

export default function EmergencySettingsPage() {
  const [setting, setSetting] = useState<TriggerSettings>(DEFAULT);
  const [windows, setWindows] = useState<NoTradeWindow[]>([]);
  const [recurring, setRecurring] = useState<RecurringRule[]>([]);
  const [blocking, setBlocking] = useState<BlockingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 모달 상태
  const [showWinModal, setShowWinModal] = useState(false);
  const [winStart, setWinStart] = useState("");
  const [winEnd, setWinEnd] = useState("");
  const [winReason, setWinReason] = useState("");
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [ruleEditId, setRuleEditId] = useState<string | null>(null);
  const [ruleStartH, setRuleStartH] = useState(23);
  const [ruleStartM, setRuleStartM] = useState(0);
  const [ruleEndH, setRuleEndH] = useState(6);
  const [ruleEndM, setRuleEndM] = useState(0);
  const [ruleReason, setRuleReason] = useState("");

  // 숫자 입력 초안 상태
  const [maxTotalDraft, setMaxTotalDraft] = useState("");
  const [maxLossDraft, setMaxLossDraft] = useState("");
  const [intervalDraft, setIntervalDraft] = useState("");
  const [maxSizeDraft, setMaxSizeDraft] = useState("");

  const loadAll = useCallback(async () => {
    try {
      const [s, w, r, b] = await Promise.all([
        fetch("/api/trigger-settings").then(x => x.json()),
        fetch("/api/no-trade-windows").then(x => x.json()),
        fetch("/api/recurring-no-trade").then(x => x.json()),
        fetch("/api/extension/blocking-status").then(x => x.json()),
      ]);
      const loaded = s.setting ?? DEFAULT;
      setSetting(loaded);
      setMaxTotalDraft(loaded.maxTotalPositionUsdt?.toString() ?? "");
      setMaxLossDraft(loaded.maxSingleLossUsdt?.toString() ?? "");
      setIntervalDraft(loaded.minIntervalMinutes?.toString() ?? "");
      setMaxSizeDraft(loaded.maxSingleSizeUsdt?.toString() ?? "");
      setWindows(w.windows ?? []);
      setRecurring(r.rules ?? []);
      setBlocking(b);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // 30초 폴링
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const b = await fetch("/api/extension/blocking-status").then(x => x.json());
        setBlocking(b);
      } catch { /* 폴링 실패 무시 */ }
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  async function putSetting(patch: Partial<TriggerSettings>) {
    setSaving(true);
    try {
      const res = await fetch("/api/trigger-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (data.setting) setSetting(data.setting);
    } finally {
      setSaving(false);
    }
  }

  // 윈도우 추가
  async function addWindow() {
    if (!winStart || !winEnd) return;
    // datetime-local 입력은 로컬 시간 (KST) → UTC 변환
    const startUTC = new Date(winStart + ":00").toISOString();
    const endUTC   = new Date(winEnd   + ":00").toISOString();
    const res = await fetch("/api/no-trade-windows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startAt: startUTC, endAt: endUTC, reason: winReason || undefined }),
    });
    if (res.ok) {
      const data = await res.json();
      setWindows(prev => [...prev, data.window].sort(
        (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
      ));
      setShowWinModal(false);
      setWinStart(""); setWinEnd(""); setWinReason("");
    }
  }

  async function deleteWindow(id: string) {
    await fetch(`/api/no-trade-windows/${id}`, { method: "DELETE" });
    setWindows(prev => prev.filter(w => w.id !== id));
  }

  // 반복 규칙 추가/수정
  async function saveRule() {
    const body = { startHour: ruleStartH, startMin: ruleStartM, endHour: ruleEndH, endMin: ruleEndM, reason: ruleReason || undefined };
    if (ruleEditId) {
      const res = await fetch(`/api/recurring-no-trade/${ruleEditId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setRecurring(prev => prev.map(r => r.id === ruleEditId ? data.rule : r));
      }
    } else {
      const res = await fetch("/api/recurring-no-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setRecurring(prev => [...prev, data.rule]);
      }
    }
    setShowRuleModal(false);
    resetRuleForm();
  }

  async function deleteRule(id: string) {
    await fetch(`/api/recurring-no-trade/${id}`, { method: "DELETE" });
    setRecurring(prev => prev.filter(r => r.id !== id));
  }

  async function toggleRule(id: string, enabled: boolean) {
    const res = await fetch(`/api/recurring-no-trade/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (res.ok) {
      const data = await res.json();
      setRecurring(prev => prev.map(r => r.id === id ? data.rule : r));
    }
  }

  function openEditRule(rule: RecurringRule) {
    setRuleEditId(rule.id);
    setRuleStartH(rule.startHour); setRuleStartM(rule.startMin);
    setRuleEndH(rule.endHour);     setRuleEndM(rule.endMin);
    setRuleReason(rule.reason ?? "");
    setShowRuleModal(true);
  }

  function resetRuleForm() {
    setRuleEditId(null);
    setRuleStartH(23); setRuleStartM(0);
    setRuleEndH(6);    setRuleEndM(0);
    setRuleReason("");
  }

  // 현재 활성 윈도우
  const now = new Date();
  const activeWindow = windows.find(w => new Date(w.startAt) <= now && new Date(w.endAt) > now);
  const futureWindows = windows.filter(w => new Date(w.startAt) > now);

  // 현재 활성 반복 규칙 (간단 체크 — UTC+9)
  const kstHour = (now.getUTCHours() + 9) % 24;
  const kstMin  = now.getUTCMinutes();
  const activeRule = recurring.find(r => {
    if (!r.enabled) return false;
    const nowMins   = kstHour * 60 + kstMin;
    const startMins = r.startHour * 60 + r.startMin;
    const endMins   = r.endHour   * 60 + r.endMin;
    return startMins <= endMins
      ? nowMins >= startMins && nowMins < endMins
      : nowMins >= startMins || nowMins < endMins;
  });

  // min_interval 남은 시간
  let intervalStatus = "";
  if (setting.minIntervalEnabled && setting.minIntervalMinutes && setting.lastPositionEntryAt) {
    const elapsed = Math.floor((Date.now() - new Date(setting.lastPositionEntryAt).getTime()) / 60_000);
    const left = setting.minIntervalMinutes - elapsed;
    intervalStatus = left > 0 ? `다음 진입 가능: ${left}분 후` : "현재 진입 가능";
  }

  if (loading) {
    return <div className="p-8 text-gray-500 dark:text-gray-400">불러오는 중...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">

      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">🛡️ Emergency Brake 설정</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          매매 충동을 막아주는 6가지 안전장치를 직접 설정하세요
        </p>
      </div>

      {/* 현재 차단 상태 */}
      {blocking && (
        <div className={`rounded-xl p-4 ${
          blocking.isBlocking
            ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
            : "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
        }`}>
          {blocking.isBlocking ? (
            <>
              <p className="font-semibold text-red-700 dark:text-red-400">⛔ 현재 매매 차단 상태입니다</p>
              <ul className="mt-2 space-y-1">
                {blocking.reasons.map((r, i) => (
                  <li key={i} className="text-sm text-red-600 dark:text-red-300">• {r}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="font-semibold text-green-700 dark:text-green-400">✓ 현재 매매 가능 상태입니다</p>
          )}
        </div>
      )}

      {/* 강제 타이핑 문장 */}
      <Card>
        <div>
          <p className="font-semibold text-gray-800 dark:text-gray-100">경고 화면에서 입력할 문장</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            경고 화면이 뜨면 이 문장을 정확히 입력해야 닫을 수 있습니다
          </p>
        </div>
        <textarea
          value={setting.forceSentence}
          onChange={e => setSetting(s => ({ ...s, forceSentence: e.target.value }))}
          rows={2}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <div className="flex justify-end">
          <SaveBtn saving={saving} onSave={() => putSetting({ forceSentence: setting.forceSentence })} />
        </div>
      </Card>

      {/* 카드 1: 총 포지션 규모 */}
      <Card>
        <CardHeader
          icon="💰" title="총 포지션 규모 제한"
          enabled={setting.maxTotalPositionEnabled}
          onToggle={() => putSetting({ maxTotalPositionEnabled: !setting.maxTotalPositionEnabled })}
        />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          보유 중인 모든 포지션의 합이 한도를 넘으면 경고
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number" min={0} step={100}
            value={maxTotalDraft}
            onChange={e => setMaxTotalDraft(e.target.value)}
            placeholder="10000"
            className="w-36 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-500 dark:text-gray-400">USDT</span>
          <SaveBtn saving={saving} onSave={() => putSetting({ maxTotalPositionUsdt: parseFloat(maxTotalDraft) || null })} />
        </div>
        <StatusBadge
          isActive={setting.maxTotalPositionEnabled && !!setting.maxTotalPositionUsdt}
          label={setting.maxTotalPositionEnabled && setting.maxTotalPositionUsdt
            ? `한도: ${setting.maxTotalPositionUsdt} USDT`
            : "비활성"}
        />
      </Card>

      {/* 카드 2: 단발성 금지 시간 */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">📅</span>
            <span className="font-semibold text-gray-800 dark:text-gray-100">특정 일정에 매매 금지</span>
          </div>
          <button
            onClick={() => setShowWinModal(true)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            + 시간 추가
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">특정 날짜와 시간을 지정해 매매를 차단 (KST)</p>

        {activeWindow && (
          <div className="text-sm text-red-600 dark:text-red-400 font-medium">
            🔴 현재 매매 금지 중 (~{fmtKST(activeWindow.endAt)} KST까지)
            {activeWindow.reason && ` — ${activeWindow.reason}`}
          </div>
        )}

        {windows.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">등록된 항목 없음</p>
        ) : (
          <ul className="space-y-2">
            {windows.map(w => (
              <li key={w.id} className="flex items-start justify-between gap-2 text-sm">
                <span className="text-gray-700 dark:text-gray-200">
                  {fmtKST(w.startAt)} → {fmtKST(w.endAt)} KST
                  {w.reason && <span className="text-gray-400 dark:text-gray-500"> ({w.reason})</span>}
                </span>
                <button onClick={() => deleteWindow(w.id)} className="text-xs text-red-500 hover:text-red-700 shrink-0">삭제</button>
              </li>
            ))}
          </ul>
        )}

        {!activeWindow && (
          <StatusBadge
            isActive={futureWindows.length > 0}
            label={futureWindows.length > 0 ? `예정된 금지 ${futureWindows.length}개` : "예정 없음"}
          />
        )}
      </Card>

      {/* 카드 3: 반복 금지 시간대 */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🕐</span>
            <span className="font-semibold text-gray-800 dark:text-gray-100">반복 금지 시간 (매일)</span>
          </div>
          <button
            onClick={() => { resetRuleForm(); setShowRuleModal(true); }}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            + 시간대 추가
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          취침 시간 등 매일 반복되는 매매 금지 시간 (KST 기준)
        </p>

        {activeRule && (
          <div className="text-sm text-red-600 dark:text-red-400 font-medium">
            🔴 현재 활성 중 (~{padT(activeRule.endHour)}:{padT(activeRule.endMin)} KST)
            {activeRule.reason && ` — ${activeRule.reason}`}
          </div>
        )}

        {recurring.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">등록된 시간대 없음</p>
        ) : (
          <ul className="space-y-2">
            {recurring.map(r => (
              <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                <span className={`text-gray-700 dark:text-gray-200 ${!r.enabled ? "opacity-40 line-through" : ""}`}>
                  {padT(r.startHour)}:{padT(r.startMin)} → {padT(r.endHour)}:{padT(r.endMin)} KST
                  {r.reason && <span className="text-gray-400 dark:text-gray-500"> ({r.reason})</span>}
                </span>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => toggleRule(r.id, !r.enabled)}
                    className="text-xs text-gray-500 hover:text-blue-500">
                    {r.enabled ? "끄기" : "켜기"}
                  </button>
                  <button onClick={() => openEditRule(r)} className="text-xs text-blue-500 hover:text-blue-700">수정</button>
                  <button onClick={() => deleteRule(r.id)} className="text-xs text-red-500 hover:text-red-700">삭제</button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <StatusBadge
          isActive={recurring.filter(r => r.enabled).length > 0}
          label={`등록된 시간대 ${recurring.filter(r => r.enabled).length}개`}
        />
      </Card>

      {/* 카드 4: 단일 포지션 손실 한도 */}
      <Card>
        <CardHeader
          icon="📉" title="포지션 손실 한도"
          enabled={setting.maxSingleLossEnabled}
          onToggle={() => putSetting({ maxSingleLossEnabled: !setting.maxSingleLossEnabled })}
        />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          보유 중인 포지션 하나의 손실이 한도를 넘으면 경고
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number" min={0} step={10}
            value={maxLossDraft}
            onChange={e => setMaxLossDraft(e.target.value)}
            placeholder="50"
            className="w-36 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-500 dark:text-gray-400">USDT</span>
          <SaveBtn saving={saving} onSave={() => putSetting({ maxSingleLossUsdt: parseFloat(maxLossDraft) || null })} />
        </div>
        <StatusBadge
          isActive={setting.maxSingleLossEnabled && !!setting.maxSingleLossUsdt}
          label={setting.maxSingleLossEnabled && setting.maxSingleLossUsdt
            ? `한도: -${setting.maxSingleLossUsdt} USDT`
            : "비활성"}
        />
      </Card>

      {/* 카드 5: 최소 매매 간격 */}
      <Card>
        <CardHeader
          icon="⏱️" title="연속 매매 방지"
          enabled={setting.minIntervalEnabled}
          onToggle={() => putSetting({ minIntervalEnabled: !setting.minIntervalEnabled })}
        />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          마지막 진입 후 일정 시간이 지나야 다음 진입 가능
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number" min={1} step={5}
            value={intervalDraft}
            onChange={e => setIntervalDraft(e.target.value)}
            placeholder="30"
            className="w-28 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-500 dark:text-gray-400">분</span>
          <SaveBtn saving={saving} onSave={() => putSetting({ minIntervalMinutes: parseInt(intervalDraft) || null })} />
        </div>
        <StatusBadge
          isActive={setting.minIntervalEnabled && !!intervalStatus}
          label={setting.minIntervalEnabled ? (intervalStatus || "비활성") : "비활성"}
        />
      </Card>

      {/* 카드 6: 1회 진입 사이즈 */}
      <Card>
        <CardHeader
          icon="💸" title="1회 진입 사이즈 제한"
          enabled={setting.maxSingleSizeEnabled}
          onToggle={() => putSetting({ maxSingleSizeEnabled: !setting.maxSingleSizeEnabled })}
        />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          한 번에 진입할 수 있는 최대 사이즈
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number" min={0} step={10}
            value={maxSizeDraft}
            onChange={e => setMaxSizeDraft(e.target.value)}
            placeholder="100"
            className="w-36 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-500 dark:text-gray-400">USDT</span>
          <SaveBtn saving={saving} onSave={() => putSetting({ maxSingleSizeUsdt: parseFloat(maxSizeDraft) || null })} />
        </div>
        <StatusBadge
          isActive={setting.maxSingleSizeEnabled && !!setting.maxSingleSizeUsdt}
          label={setting.maxSingleSizeEnabled && setting.maxSingleSizeUsdt
            ? `한도: ${setting.maxSingleSizeUsdt} USDT`
            : "비활성"}
        />
      </Card>

      {/* 모달: 단발성 금지 시간 추가 */}
      {showWinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">매매 금지 시간 추가</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">KST 기준으로 입력하세요</p>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">시작</label>
              <input type="datetime-local" value={winStart} onChange={e => setWinStart(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">종료</label>
              <input type="datetime-local" value={winEnd} onChange={e => setWinEnd(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="text" value={winReason} onChange={e => setWinReason(e.target.value)}
                placeholder="메모 (선택)"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowWinModal(false)}
                className="flex-1 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
                취소
              </button>
              <button onClick={addWindow}
                className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 모달: 반복 시간대 추가/수정 */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
              {ruleEditId ? "반복 시간대 수정" : "반복 시간대 추가"}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              KST 기준. 자정 넘어가는 범위 (예: 23:00 → 06:00) 가능.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">시작 (KST)</label>
                <div className="flex items-center gap-2">
                  <input type="number" min={0} max={23} value={ruleStartH} onChange={e => setRuleStartH(Number(e.target.value))}
                    className="w-16 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-center text-gray-800 dark:text-gray-100" />
                  <span className="text-gray-500">시</span>
                  <input type="number" min={0} max={59} value={ruleStartM} onChange={e => setRuleStartM(Number(e.target.value))}
                    className="w-16 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-center text-gray-800 dark:text-gray-100" />
                  <span className="text-gray-500">분</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">종료 (KST)</label>
                <div className="flex items-center gap-2">
                  <input type="number" min={0} max={23} value={ruleEndH} onChange={e => setRuleEndH(Number(e.target.value))}
                    className="w-16 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-center text-gray-800 dark:text-gray-100" />
                  <span className="text-gray-500">시</span>
                  <input type="number" min={0} max={59} value={ruleEndM} onChange={e => setRuleEndM(Number(e.target.value))}
                    className="w-16 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-center text-gray-800 dark:text-gray-100" />
                  <span className="text-gray-500">분</span>
                </div>
              </div>
              <input type="text" value={ruleReason} onChange={e => setRuleReason(e.target.value)}
                placeholder="메모 (예: 취침 시간)"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
                미리보기: {padT(ruleStartH)}:{padT(ruleStartM)} → {padT(ruleEndH)}:{padT(ruleEndM)} KST
                {(ruleStartH * 60 + ruleStartM) >= (ruleEndH * 60 + ruleEndM)
                  ? " (자정 넘어가는 범위)"
                  : ""}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowRuleModal(false); resetRuleForm(); }}
                className="flex-1 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
                취소
              </button>
              <button onClick={saveRule}
                className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
                저장
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
