'use client';
// 요약 통계 4개 카드 (총 거래수, 승률, 순손익, 평균 ROI)
import type { StatsResult } from "@/lib/stats";

interface Props {
  current: StatsResult["summary"];
  prev?: StatsResult["summary"];
}

/** 전기간 대비 증감 뱃지 */
function Delta({ cur, pre, unit = "", inverse = false }: {
  cur: number; pre: number; unit?: string; inverse?: boolean;
}) {
  const delta = parseFloat((cur - pre).toFixed(2));
  if (delta === 0) return null;
  const positive = inverse ? delta < 0 : delta > 0;
  const sign = delta > 0 ? "+" : "";
  return (
    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
      positive
        ? "bg-green-400/10 text-green-400"
        : "bg-red-500/10 text-red-400"
    }`}>
      {sign}{delta}{unit}
    </span>
  );
}

export default function SummaryStats({ current, prev }: Props) {
  const cards = [
    {
      label: "총 거래수",
      value: current.totalTrades.toString(),
      sub: "회",
      delta: prev ? (
        <Delta cur={current.totalTrades} pre={prev.totalTrades} unit="회" />
      ) : null,
    },
    {
      label: "승률",
      value: current.winRate.toFixed(1),
      sub: "%",
      valueClass: current.winRate >= 50 ? "text-green-400" : "text-red-400",
      delta: prev ? (
        <Delta cur={current.winRate} pre={prev.winRate} unit="%p" />
      ) : null,
    },
    {
      label: "순손익",
      value: (current.totalPnl >= 0 ? "+" : "") + current.totalPnl.toFixed(2),
      sub: " USDT",
      valueClass: current.totalPnl >= 0 ? "text-green-400" : "text-red-400",
      delta: prev ? (
        <Delta cur={current.totalPnl} pre={prev.totalPnl} unit=" U" />
      ) : null,
    },
    {
      label: "평균 ROI",
      value: (current.avgRoi >= 0 ? "+" : "") + current.avgRoi.toFixed(2),
      sub: "%",
      valueClass: current.avgRoi >= 0 ? "text-green-400" : "text-red-400",
      delta: prev ? (
        <Delta cur={current.avgRoi} pre={prev.avgRoi} unit="%p" />
      ) : null,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="bg-gray-900 border border-gray-800 rounded-xl p-4 shadow-sm"
        >
          <p className="text-xs text-gray-500 mb-1">{c.label}</p>
          <div className="flex items-end gap-1.5 flex-wrap">
            <span className={`text-2xl font-bold tabular-nums ${c.valueClass ?? "text-white"}`}>
              {c.value}
            </span>
            <span className="text-sm text-gray-500 mb-0.5">{c.sub}</span>
          </div>
          {c.delta && <div className="mt-1.5">{c.delta}</div>}
        </div>
      ))}
    </div>
  );
}
