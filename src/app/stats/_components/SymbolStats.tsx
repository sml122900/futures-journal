'use client';
// 심볼별 거래 통계 테이블
import type { StatsResult } from "@/lib/stats";

interface Props {
  data: StatsResult["symbolStats"];
}

function winRateClass(wr: number) {
  if (wr >= 60) return "text-green-400 bg-green-400/10";
  if (wr >= 40) return "text-yellow-400 bg-yellow-400/10";
  return "text-red-400 bg-red-500/10";
}

function label(roi: number) {
  if (roi > 1.5) return { text: "⭐ 강점 심볼", cls: "text-green-400" };
  if (roi < 0)   return { text: "⚠️ 약점 심볼", cls: "text-red-400" };
  return { text: "보통", cls: "text-gray-500" };
}

export default function SymbolStats({ data }: Props) {
  if (!data.length) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">심볼별 통계</h2>
        <p className="text-sm text-gray-500">데이터가 부족합니다.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-300 mb-4">심볼별 통계</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {["심볼", "승률", "평균 ROI", "거래수", "손익 (USDT)", "평가"].map((h) => (
                <th key={h} className="text-left text-xs text-gray-500 font-medium pb-2 pr-4 last:pr-0">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const lbl = label(row.avgRoi);
              return (
                <tr key={row.symbol} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="py-2 pr-4 font-semibold text-white">{row.symbol}</td>
                  <td className="py-2 pr-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${winRateClass(row.winRate)}`}>
                      {row.winRate}%
                    </span>
                  </td>
                  <td className={`py-2 pr-4 font-medium tabular-nums ${row.avgRoi >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {row.avgRoi >= 0 ? "+" : ""}{row.avgRoi}%
                  </td>
                  <td className="py-2 pr-4 text-gray-400">{row.trades}회</td>
                  <td className={`py-2 pr-4 tabular-nums font-medium ${row.totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {row.totalPnl >= 0 ? "+" : ""}{row.totalPnl.toFixed(2)}
                  </td>
                  <td className={`py-2 text-xs font-medium ${lbl.cls}`}>{lbl.text}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
