'use client';
// 라이브 위험 모니터 위젯 (대시보드 상단 항상 표시)
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { RuleType } from "@/lib/rules-types";
import { RULE_META } from "@/lib/rules-types";

interface Rule {
  id: string;
  type: RuleType;
  config: Record<string, unknown>;
  enabled: boolean;
}

interface StatusData {
  todayTrades: number;
  todayPnl: number;
  todayMargin: number;
  lastTradeMinutesAgo: number | null;
  dailyLimitPct: number | null;
  cooldownRemainingMin: number | null;
}

type RiskLevel = "safe" | "warning" | "danger";

const LEVEL_STYLES: Record<RiskLevel, { dot: string; bg: string; text: string; label: string }> = {
  safe:    { dot: "bg-green-400",  bg: "bg-green-400/5 border-green-400/20",  text: "text-green-400",  label: "🟢 안전" },
  warning: { dot: "bg-yellow-400", bg: "bg-yellow-400/5 border-yellow-400/20", text: "text-yellow-400", label: "🟡 주의" },
  danger:  { dot: "bg-red-400",    bg: "bg-red-400/5 border-red-400/20",       text: "text-red-400",    label: "🔴 위험" },
};

/** 시간 경과를 "X분 전 / X시간 전" 형식으로 */
function fmtElapsed(min: number): string {
  if (min < 60) return `${min}분 전`;
  return `${Math.floor(min / 60)}시간 ${min % 60}분 전`;
}

/** 경과 시간을 "X분 남음" 형식으로 */
function fmtRemaining(min: number): string {
  if (min === 0) return "완료";
  if (min < 60) return `${min}분 남음`;
  return `${Math.floor(min / 60)}시간 ${min % 60}분 남음`;
}

export default function RiskMonitor() {
  const [rules, setRules]     = useState<Rule[]>([]);
  const [status, setStatus]   = useState<StatusData | null>(null);
  const [loaded, setLoaded]   = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const load = useCallback(async () => {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const [rulesRes, statusRes] = await Promise.all([
      fetch("/api/rules"),
      fetch("/api/rules/status"),
    ]);
    const [rulesJson, statusJson] = await Promise.all([rulesRes.json(), statusRes.json()]);
    if (rulesJson.success) setRules(rulesJson.data);
    if (statusJson.success) setStatus(statusJson.data);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000); // 1분마다 갱신
    return () => clearInterval(timer);
  }, [load]);

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

  // 위험도 계산
  const utcHour = new Date().getUTCHours();
  const alerts: string[] = [];
  let level: RiskLevel = "safe";

  for (const rule of rules) {
    if (!rule.enabled) continue;
    const cfg = rule.config as Record<string, unknown>;

    if (rule.type === "time_block") {
      const hours = (cfg.hours as number[]) ?? [];
      if (hours.includes(utcHour)) {
        alerts.push(`현재 ${utcHour}시 차단 구간`);
        level = "warning";
      }
    }
    if (rule.type === "cooldown" && status?.cooldownRemainingMin !== null && (status?.cooldownRemainingMin ?? 0) > 0) {
      alerts.push(`쿨다운 ${fmtRemaining(status!.cooldownRemainingMin!)}`);
      level = "warning";
    }
    if (rule.type === "daily_limit" && status?.dailyLimitPct !== null) {
      const pct = status!.dailyLimitPct!;
      if (pct >= 100) {
        alerts.push(`일일 손실 한도 초과 (${pct.toFixed(0)}%)`);
        level = "danger";
      } else if (pct >= 70) {
        alerts.push(`일일 손실 한도 ${pct.toFixed(0)}% 소진`);
        if (level !== "danger") level = "warning";
      }
    }
  }

  const style = LEVEL_STYLES[level];
  const enabledCount = rules.filter((r) => r.enabled).length;
  const hasDailyLimit = rules.some((r) => r.enabled && r.type === "daily_limit");
  const hasCooldown   = rules.some((r) => r.enabled && r.type === "cooldown");

  return (
    <div className={`border rounded-xl px-4 py-3 ${style.bg}`}>
      {/* 상단 행: 상태 레이블 + 요약 지표 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`w-2 h-2 rounded-full shrink-0 ${style.dot} ${level !== "safe" ? "animate-pulse" : ""}`} />
          <span className={`text-sm font-medium ${style.text}`}>{style.label}</span>
          <span className="text-xs text-gray-600">|</span>
          <span className="text-xs text-gray-500">활성 룰 {enabledCount}개</span>

          {/* 오늘 거래 횟수 + 손익 */}
          {status && (
            <>
              <span className="text-xs text-gray-600">|</span>
              <span className="text-xs text-gray-400">
                오늘 {status.todayTrades}회
                {status.todayTrades > 0 && (
                  <span className={` ml-1 font-medium ${status.todayPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {status.todayPnl >= 0 ? "+" : ""}{status.todayPnl.toFixed(2)} U
                  </span>
                )}
              </span>
            </>
          )}

          {/* 마지막 거래 경과 (쿨다운 룰 있을 때만) */}
          {hasCooldown && status?.lastTradeMinutesAgo !== null && (
            <>
              <span className="text-xs text-gray-600">|</span>
              <span className="text-xs text-gray-500">
                마지막 {fmtElapsed(status!.lastTradeMinutesAgo!)}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link href="/rules" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
            룰 관리
          </Link>
          <button onClick={() => setCollapsed((v) => !v)} className="text-xs text-gray-600 hover:text-gray-400">
            {collapsed ? "▼" : "▲"}
          </button>
        </div>
      </div>

      {/* 확장 영역 */}
      {!collapsed && (
        <div className="mt-2 space-y-2">
          {/* 경고 메시지 */}
          {alerts.length > 0 && (
            <div className="space-y-1">
              {alerts.map((alert, i) => (
                <p key={i} className="text-xs text-yellow-400 flex items-center gap-1.5">
                  <span>⚠️</span>{alert}
                </p>
              ))}
            </div>
          )}

          {/* 일일 한도 진행도 바 */}
          {hasDailyLimit && status?.dailyLimitPct !== null && (
            <div className="space-y-0.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">일일 손실 한도</span>
                <span className={status!.dailyLimitPct! >= 70 ? "text-red-400 font-medium" : "text-gray-400"}>
                  {Math.min(status!.dailyLimitPct!, 100).toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${status!.dailyLimitPct! >= 100 ? "bg-red-500" : status!.dailyLimitPct! >= 70 ? "bg-yellow-500" : "bg-green-500"}`}
                  style={{ width: `${Math.min(status!.dailyLimitPct!, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* 활성 룰 태그 */}
          <div className="flex flex-wrap gap-1.5">
            {rules.filter((r) => r.enabled).map((rule) => (
              <span key={rule.id} className="text-[10px] text-gray-600 bg-gray-800/50 px-2 py-0.5 rounded-full">
                {RULE_META[rule.type]?.label ?? rule.type}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
