'use client';
// 진입이유 × 심리상태 히트맵 매트릭스
import { useState } from "react";
import type { StatsResult } from "@/lib/stats";

interface Props {
  data: StatsResult["patternMatrix"];
}

/** 승률에 따른 셀 배경 색상 */
function winRateBg(winRate: number): string {
  if (winRate >= 60) return "rgba(34,197,94,0.18)";  // 초록
  if (winRate >= 40) return "rgba(234,179,8,0.18)";  // 노랑
  return "rgba(239,68,68,0.18)";                      // 빨강
}

function winRateText(winRate: number): string {
  if (winRate >= 60) return "#4ade80";
  if (winRate >= 40) return "#facc15";
  return "#f87171";
}

/** 고정 위치 툴팁 */
interface TooltipState {
  text: string;
  x: number;
  y: number;
}

export default function PatternMatrix({ data }: Props) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  if (!data.length) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">진입이유 × 심리상태</h2>
        <p className="text-sm text-gray-500">메모가 있는 포지션이 없습니다. 매매 후 메모를 작성하면 패턴이 표시됩니다.</p>
      </div>
    );
  }

  // 고유 이유·심리 목록
  const reasons = [...new Set(data.map((d) => d.reason))];
  const psychs  = [...new Set(data.map((d) => d.psych))];
  const cellMap = new Map(data.map((d) => [`${d.reason}|${d.psych}`, d]));

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-300 mb-4">진입이유 × 심리상태</h2>

      <div className="overflow-x-auto">
        <table className="border-collapse text-xs min-w-max">
          <thead>
            <tr>
              <th className="text-left text-gray-500 font-normal pb-2 pr-3 min-w-[120px]">이유 \ 심리</th>
              {psychs.map((p) => (
                <th key={p} className="text-center text-gray-400 font-medium pb-2 px-2 min-w-[80px]">
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reasons.map((reason) => (
              <tr key={reason}>
                <td className="text-gray-400 pr-3 py-1 text-xs max-w-[140px] truncate">
                  {reason}
                </td>
                {psychs.map((psych) => {
                  const cell = cellMap.get(`${reason}|${psych}`);
                  return (
                    <td key={psych} className="py-1 px-1 text-center">
                      {cell ? (
                        <div
                          className="relative group mx-auto rounded-md py-1.5 px-2 cursor-default transition-opacity hover:opacity-80"
                          style={{ backgroundColor: winRateBg(cell.winRate) }}
                          onMouseEnter={(e) => {
                            const r = e.currentTarget.getBoundingClientRect();
                            setTooltip({
                              text: `거래 ${cell.count}회 · 승률 ${cell.winRate}% · 손익 ${cell.totalPnl >= 0 ? "+" : ""}${cell.totalPnl.toFixed(1)} USDT`,
                              x: r.left + r.width / 2,
                              y: r.top - 8,
                            });
                          }}
                          onMouseLeave={() => setTooltip(null)}
                        >
                          <span className="font-bold tabular-nums" style={{ color: winRateText(cell.winRate) }}>
                            {cell.winRate}%
                          </span>
                          <span className="text-gray-500 ml-1">({cell.count})</span>
                        </div>
                      ) : (
                        <div className="mx-auto rounded-md py-1.5 px-2 bg-gray-800/50">
                          <span className="text-gray-700">─</span>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-800">
        <span className="text-xs text-gray-600">승률 기준:</span>
        {[
          { color: "rgba(34,197,94,0.18)", text: "60%↑ 초록" },
          { color: "rgba(234,179,8,0.18)", text: "40~60% 노랑" },
          { color: "rgba(239,68,68,0.18)", text: "40%↓ 빨강" },
        ].map((l) => (
          <div key={l.text} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: l.color }} />
            <span className="text-xs text-gray-500">{l.text}</span>
          </div>
        ))}
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
