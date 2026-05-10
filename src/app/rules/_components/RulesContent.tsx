'use client';
// 룰 목록 + 관리 클라이언트 컴포넌트
import { useState, useEffect, useCallback } from "react";
import { RULE_META, type RuleType } from "@/lib/rules-types";
import RuleFormModal, { ruleConfigSummary } from "./RuleFormModal";

interface Rule {
  id: string;
  type: RuleType;
  config: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
}

interface StatsByType {
  type: string;
  count: number;
}

const RULE_ICONS: Record<RuleType, string> = {
  time_block:   "🕐",
  cooldown:     "⏸",
  daily_limit:  "📉",
  psych_block:  "🧠",
  liq_distance: "⚡",
  loss_streak:  "🔥",
};

const RULE_COLORS: Record<RuleType, string> = {
  time_block:   "bg-blue-400/10 border-blue-400/20 text-blue-400",
  cooldown:     "bg-orange-400/10 border-orange-400/20 text-orange-400",
  daily_limit:  "bg-red-400/10 border-red-400/20 text-red-400",
  psych_block:  "bg-purple-400/10 border-purple-400/20 text-purple-400",
  liq_distance: "bg-yellow-400/10 border-yellow-400/20 text-yellow-400",
  loss_streak:  "bg-red-400/10 border-red-400/20 text-red-400",
};

export default function RulesContent() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [statsMap, setStatsMap] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Rule | undefined>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesRes, statsRes] = await Promise.all([
        fetch("/api/rules"),
        fetch("/api/rules/stats"),
      ]);
      const [rulesJson, statsJson] = await Promise.all([rulesRes.json(), statsRes.json()]);
      if (rulesJson.success) setRules(rulesJson.data);
      if (statsJson.success) {
        const map = new Map<string, number>();
        (statsJson.data.byType as StatsByType[]).forEach(({ type, count }) => map.set(type, count));
        setStatsMap(map);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleEnabled(rule: Rule) {
    await fetch(`/api/rules/${rule.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !rule.enabled }),
    });
    setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, enabled: !r.enabled } : r));
  }

  async function deleteRule(id: string) {
    if (!window.confirm("이 룰을 삭제하시겠습니까? 위반 기록도 함께 삭제됩니다.")) return;
    await fetch(`/api/rules/${id}`, { method: "DELETE" });
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  function openNew() { setEditing(undefined); setShowModal(true); }
  function openEdit(rule: Rule) { setEditing(rule); setShowModal(true); }
  function onSaved() { setShowModal(false); load(); }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">리스크 룰 관리</h1>
          <p className="text-sm text-gray-500 mt-0.5">포지션 진입 시 룰 위반을 자동으로 감지합니다.</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-black font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
        >
          <span className="text-base leading-none">+</span> 새 룰 추가
        </button>
      </div>

      {/* 룰 목록 */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-800 rounded-xl h-32" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-4xl mb-3">🛡️</p>
          <p className="text-gray-300 font-medium mb-1">등록된 룰이 없습니다</p>
          <p className="text-sm text-gray-500 mb-6">매매 룰을 등록하면 포지션 진입 시 위반을 자동으로 감지합니다.</p>
          <button onClick={openNew}
            className="bg-green-500 hover:bg-green-400 text-black font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors">
            첫 번째 룰 추가하기
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules.map((rule) => {
            const violationCount = statsMap.get(rule.type) ?? 0;
            const colorCls = RULE_COLORS[rule.type] ?? "bg-gray-800 border-gray-700 text-gray-400";
            return (
              <div
                key={rule.id}
                className={`bg-gray-900 border rounded-xl p-4 shadow-sm transition-opacity ${!rule.enabled ? "opacity-50" : ""}`}
              >
                {/* 상단: 아이콘 + 타입 + 위반 뱃지 + 토글 */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{RULE_ICONS[rule.type]}</span>
                    <div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${colorCls}`}>
                        {RULE_META[rule.type]?.label ?? rule.type}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {violationCount > 0 && (
                      <span className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded-full">
                        이번 달 {violationCount}회
                      </span>
                    )}
                    {/* 토글 스위치 */}
                    <button
                      onClick={() => toggleEnabled(rule)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${rule.enabled ? "bg-green-500" : "bg-gray-700"}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${rule.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                    </button>
                  </div>
                </div>

                {/* 설정 요약 */}
                <p className="text-sm text-gray-300 mb-3">
                  {ruleConfigSummary(rule.type, rule.config)}
                </p>

                {/* 수정/삭제 */}
                <div className="flex gap-2 pt-2 border-t border-gray-800">
                  <button onClick={() => openEdit(rule)}
                    className="text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors">
                    수정
                  </button>
                  <button onClick={() => deleteRule(rule.id)}
                    className="text-xs text-red-400 hover:text-red-300 bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors">
                    삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <RuleFormModal
          existing={editing ? { id: editing.id, type: editing.type, config: editing.config, enabled: editing.enabled } : undefined}
          onSave={onSaved}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
