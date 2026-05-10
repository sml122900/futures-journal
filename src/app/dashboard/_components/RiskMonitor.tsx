'use client';
// 라이브 위험 모니터 위젯 (대시보드 상단 항상 표시)
import { useState, useEffect } from "react";
import Link from "next/link";
import type { RuleType } from "@/lib/rules-types";
import { RULE_META } from "@/lib/rules-types";

interface Rule {
  id: string;
  type: RuleType;
  config: Record<string, unknown>;
  enabled: boolean;
}

type RiskLevel = "safe" | "warning" | "danger";

interface RiskStatus {
  level: RiskLevel;
  alerts: string[];
}

/** 활성 룰 기준 현재 위험도 클라이언트 계산 */
function computeRisk(rules: Rule[]): RiskStatus {
  const alerts: string[] = [];
  const now = new Date();
  const utcHour = now.getUTCHours();

  for (const rule of rules) {
    if (!rule.enabled) continue;
    const cfg = rule.config;

    if (rule.type === "time_block") {
      const hours = (cfg.hours as number[]) ?? [];
      if (hours.includes(utcHour)) {
        alerts.push(`현재 ${utcHour}시 차단 구간`);
      }
    }
    // 다른 룰(cooldown, daily_limit 등)은 서버 데이터 필요 → 위반 기록 기반으로 표시
  }

  return {
    level: alerts.length > 0 ? "warning" : "safe",
    alerts,
  };
}

const LEVEL_STYLES: Record<RiskLevel, { dot: string; bg: string; text: string; label: string }> = {
  safe:    { dot: "bg-green-400",  bg: "bg-green-400/5 border-green-400/20",  text: "text-green-400",  label: "🟢 안전" },
  warning: { dot: "bg-yellow-400", bg: "bg-yellow-400/5 border-yellow-400/20", text: "text-yellow-400", label: "🟡 주의" },
  danger:  { dot: "bg-red-400",    bg: "bg-red-400/5 border-red-400/20",       text: "text-red-400",    label: "🔴 위험" },
};

export default function RiskMonitor() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [todayViolations, setTodayViolations] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    async function load() {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);

      const [rulesRes, violationsRes] = await Promise.all([
        fetch("/api/rules"),
        fetch(`/api/rules/violations?from=${todayStart.toISOString()}`),
      ]);
      const [rulesJson, violationsJson] = await Promise.all([rulesRes.json(), violationsRes.json()]);
      if (rulesJson.success) setRules(rulesJson.data);
      if (violationsJson.success) setTodayViolations(violationsJson.data.length);
      setLoaded(true);
    }
    load();
    // 1분마다 time_block 상태 갱신
    const timer = setInterval(() => setLoaded((v) => !v || true), 60000);
    return () => clearInterval(timer);
  }, []);

  if (!loaded) return null;

  // 룰이 없으면 CTA
  if (rules.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center justify-between text-sm">
        <span className="text-gray-500">🛡️ 리스크 룰 미설정</span>
        <Link href="/rules" className="text-green-400 hover:text-green-300 text-xs font-medium">
          룰 추가하기 →
        </Link>
      </div>
    );
  }

  const { level, alerts } = computeRisk(rules);
  const style = LEVEL_STYLES[level];
  const enabledCount = rules.filter((r) => r.enabled).length;

  return (
    <div className={`border rounded-xl px-4 py-3 ${style.bg}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${style.dot} ${level !== "safe" ? "animate-pulse" : ""}`} />
          <span className={`text-sm font-medium ${style.text}`}>{style.label}</span>
          <span className="text-xs text-gray-600">|</span>
          <span className="text-xs text-gray-500">활성 룰 {enabledCount}개</span>
          {todayViolations > 0 && (
            <>
              <span className="text-xs text-gray-600">|</span>
              <span className="text-xs text-red-400">오늘 위반 {todayViolations}회</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/rules" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
            룰 관리
          </Link>
          <button onClick={() => setCollapsed((v) => !v)} className="text-xs text-gray-600 hover:text-gray-400">
            {collapsed ? "▼" : "▲"}
          </button>
        </div>
      </div>

      {!collapsed && alerts.length > 0 && (
        <div className="mt-2 space-y-1">
          {alerts.map((alert, i) => (
            <p key={i} className="text-xs text-yellow-400 flex items-center gap-1.5">
              <span>⚠️</span>{alert}
            </p>
          ))}
        </div>
      )}

      {!collapsed && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {rules.filter((r) => r.enabled).map((rule) => (
            <span key={rule.id} className="text-[10px] text-gray-600 bg-gray-800/50 px-2 py-0.5 rounded-full">
              {RULE_META[rule.type]?.label ?? rule.type}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
