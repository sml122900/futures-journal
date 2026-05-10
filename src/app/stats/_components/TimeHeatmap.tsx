'use client';
// 요일 × 시간대 거래 히트맵 (손익 강도로 색상 표현)
import { useState } from "react";
import type { StatsResult } from "@/lib/stats";

interface Props {
  data: StatsResult["timeHeatmap"];
}

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface TooltipState { text: string; x: number; y: number; }

/** 손익 강도에 따른 인라인 배경 색상 */
function cellStyle(
  cell: StatsResult["timeHeatmap"][number] | undefined,
  maxAbsPnl: number
): React.CSSProperties {
  if (!cell || cell.count === 0) return { backgroundColor: "rgba(55,65,81,0.4)" }; // gray-700/40

  const intensity = Math.min(Math.abs(cell.totalPnl) / Math.max(maxAbsPnl, 1), 1);
  const alpha = 0.15 + intensity * 0.65;

  if (cell.totalPnl >= 0) return { backgroundColor: `rgba(34,197,94,${alpha.toFixed(2)})` };
  return { backgroundColor: `rgba(239,68,68,${alpha.toFixed(2)})` };
}

export default function TimeHeatmap({ data }: Props) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  if (!data.length) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">시간대별 거래 히트맵</h2>
        <p className="text-sm text-gray-500">데이터가 부족합니다.</p>
      </div>
    );
  }

  const heatMap = new Map(data.map((d) => [`${d.dayOfWeek}-${d.hour}`, d]));
  const maxAbsPnl = Math.max(...data.map((d) => Math.abs(d.totalPnl)), 1);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-300 mb-4">시간대별 거래 히트맵 (UTC)</h2>

      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          {/* 시간 헤더 */}
          <div className="flex items-center mb-1">
            <div className="w-7 shrink-0" />
            {HOURS.map((h) => (
              <div key={h} className="flex-1 text-center text-[9px] text-gray-600">
                {h % 3 === 0 ? h : ""}
              </div>
            ))}
          </div>

          {/* 요일 × 시간 그리드 */}
          {DAY_LABELS.map((day, dayIdx) => (
            <div key={day} className="flex items-center mb-0.5">
              <div className="w-7 shrink-0 text-[10px] text-gray-500 font-medium">{day}</div>
              {HOURS.map((hour) => {
                const cell = heatMap.get(`${dayIdx}-${hour}`);
                const style = cellStyle(cell, maxAbsPnl);
                const tooltipText = cell && cell.count > 0
                  ? `${DAY_LABELS[dayIdx]}요일 ${hour}시 | ${cell.count}회 | ${cell.totalPnl >= 0 ? "+" : ""}${cell.totalPnl.toFixed(1)} USDT | 승률 ${cell.winRate}%`
                  : `${DAY_LABELS[dayIdx]}요일 ${hour}시 | 거래 없음`;

                return (
                  <div
                    key={hour}
                    className="flex-1 h-6 rounded-[2px] mx-px cursor-default transition-opacity hover:opacity-80"
                    style={style}
                    onMouseEnter={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setTooltip({ text: tooltipText, x: r.left + r.width / 2, y: r.top - 8 });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })}
            </div>
          ))}

          {/* 범례 */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-800">
            <span className="text-[10px] text-gray-600">색상:</span>
            <div className="flex items-center gap-1.5">
              <div className="w-12 h-3 rounded-sm" style={{ background: "linear-gradient(to right, rgba(34,197,94,0.15), rgba(34,197,94,0.85))" }} />
              <span className="text-[10px] text-gray-500">수익 강도</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-12 h-3 rounded-sm" style={{ background: "linear-gradient(to right, rgba(239,68,68,0.15), rgba(239,68,68,0.85))" }} />
              <span className="text-[10px] text-gray-500">손실 강도</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded-sm bg-gray-700/40" />
              <span className="text-[10px] text-gray-500">거래 없음</span>
            </div>
          </div>
        </div>
      </div>

      {tooltip && (
        <div
          className="fixed z-50 bg-gray-950 border border-gray-700 text-xs text-gray-300 px-2.5 py-1.5 rounded-lg shadow-xl pointer-events-none -translate-x-1/2 -translate-y-full"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
