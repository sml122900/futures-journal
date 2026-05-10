// 거래 통계 계산 유틸 (포지션 내역 + 메모 기반)

export interface PositionRecord {
  positionId: string;
  symbol: string;
  holdSide: string;
  openAvgPrice: string;
  closeAvgPrice: string;
  marginSize: string;
  netProfit: string;
  openTime: string;
  closeTime: string;
}

export interface MemoRecord {
  positionId: string;
  reason: string;
  exitReason: string;
  psych: string;
  external: string;
  text: string;
}

export interface StatsResult {
  summary: {
    totalTrades: number;
    winRate: number;
    totalPnl: number;
    avgRoi: number;
  };
  patternMatrix: {
    reason: string;
    psych: string;
    count: number;
    winRate: number;
    totalPnl: number;
  }[];
  timeHeatmap: {
    dayOfWeek: number;
    hour: number;
    count: number;
    winRate: number;
    totalPnl: number;
  }[];
  symbolStats: {
    symbol: string;
    trades: number;
    winRate: number;
    avgRoi: number;
    totalPnl: number;
  }[];
  priceAnalysis: {
    avgEntryDeviation: null;
    avgExitMissed: null;
  };
}

/** "ETHUSDT" → "ETH" */
function symShort(raw: string) {
  return raw.replace(/USDT$|USD$|PERP$/i, "");
}

/**
 * 포지션 목록과 메모 목록으로 거래 통계 계산
 * @param positions 비트겟 position-history API 응답 list 배열
 * @param memos DB에서 조회한 사용자 메모 배열
 */
export function computeStats(
  positions: PositionRecord[],
  memos: MemoRecord[]
): StatsResult {
  const memoMap = new Map<string, MemoRecord>();
  memos.forEach((m) => memoMap.set(m.positionId, m));

  // summary
  let wins = 0;
  let totalPnl = 0;
  let roiSum = 0;

  for (const p of positions) {
    const pnl = parseFloat(p.netProfit || "0");
    const margin = parseFloat(p.marginSize || "0");
    if (pnl > 0) wins++;
    totalPnl += pnl;
    if (margin > 0) roiSum += (pnl / margin) * 100;
  }

  const total = positions.length;
  const summary = {
    totalTrades: total,
    winRate: total > 0 ? parseFloat(((wins / total) * 100).toFixed(1)) : 0,
    totalPnl: parseFloat(totalPnl.toFixed(2)),
    avgRoi: total > 0 ? parseFloat((roiSum / total).toFixed(2)) : 0,
  };

  // patternMatrix: 진입이유 × 심리상태 매트릭스 (메모 있는 포지션만)
  const patternMap = new Map<string, { count: number; wins: number; pnl: number }>();
  for (const p of positions) {
    const memo = memoMap.get(p.positionId);
    if (!memo) continue;
    const reason = memo.reason.trim() || "미입력";
    const psych = memo.psych.trim() || "미입력";
    const key = `${reason}\0${psych}`;
    const pnl = parseFloat(p.netProfit || "0");
    const prev = patternMap.get(key) ?? { count: 0, wins: 0, pnl: 0 };
    patternMap.set(key, {
      count: prev.count + 1,
      wins: prev.wins + (pnl > 0 ? 1 : 0),
      pnl: prev.pnl + pnl,
    });
  }

  const patternMatrix = Array.from(patternMap.entries())
    .map(([key, v]) => {
      const [reason, psych] = key.split("\0");
      return {
        reason,
        psych,
        count: v.count,
        winRate: parseFloat(((v.wins / v.count) * 100).toFixed(1)),
        totalPnl: parseFloat(v.pnl.toFixed(2)),
      };
    })
    .sort((a, b) => b.count - a.count);

  // timeHeatmap: 요일(0-6) × 시간(0-23) (closeTime 기준 UTC)
  const heatMap = new Map<string, { count: number; wins: number; pnl: number }>();
  for (const p of positions) {
    const ts = parseInt(p.closeTime || p.openTime || "0");
    if (!ts) continue;
    const d = new Date(ts);
    const dayOfWeek = d.getUTCDay();
    const hour = d.getUTCHours();
    const key = `${dayOfWeek}-${hour}`;
    const pnl = parseFloat(p.netProfit || "0");
    const prev = heatMap.get(key) ?? { count: 0, wins: 0, pnl: 0 };
    heatMap.set(key, {
      count: prev.count + 1,
      wins: prev.wins + (pnl > 0 ? 1 : 0),
      pnl: prev.pnl + pnl,
    });
  }

  const timeHeatmap = Array.from(heatMap.entries())
    .map(([key, v]) => {
      const [day, hr] = key.split("-").map(Number);
      return {
        dayOfWeek: day,
        hour: hr,
        count: v.count,
        winRate: parseFloat(((v.wins / v.count) * 100).toFixed(1)),
        totalPnl: parseFloat(v.pnl.toFixed(2)),
      };
    })
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.hour - b.hour);

  // symbolStats: 심볼별 집계
  const symMap = new Map<string, { count: number; wins: number; pnl: number; roiSum: number }>();
  for (const p of positions) {
    const sym = symShort(p.symbol);
    const pnl = parseFloat(p.netProfit || "0");
    const margin = parseFloat(p.marginSize || "0");
    const roi = margin > 0 ? (pnl / margin) * 100 : 0;
    const prev = symMap.get(sym) ?? { count: 0, wins: 0, pnl: 0, roiSum: 0 };
    symMap.set(sym, {
      count: prev.count + 1,
      wins: prev.wins + (pnl > 0 ? 1 : 0),
      pnl: prev.pnl + pnl,
      roiSum: prev.roiSum + roi,
    });
  }

  const symbolStats = Array.from(symMap.entries())
    .map(([symbol, v]) => ({
      symbol,
      trades: v.count,
      winRate: parseFloat(((v.wins / v.count) * 100).toFixed(1)),
      avgRoi: parseFloat((v.roiSum / v.count).toFixed(2)),
      totalPnl: parseFloat(v.pnl.toFixed(2)),
    }))
    .sort((a, b) => b.trades - a.trades);

  return {
    summary,
    patternMatrix,
    timeHeatmap,
    symbolStats,
    // 캔들 데이터 필요 → 현재 미지원
    priceAnalysis: { avgEntryDeviation: null, avgExitMissed: null },
  };
}

/** 최근 N개 포지션과 메모를 Claude 프롬프트용 텍스트로 변환 */
export function buildInsightContext(
  positions: PositionRecord[],
  memos: MemoRecord[]
): string {
  const memoMap = new Map<string, MemoRecord>();
  memos.forEach((m) => memoMap.set(m.positionId, m));

  const lines: string[] = [];
  for (const p of positions.slice(0, 50)) {
    const pnl = parseFloat(p.netProfit || "0");
    const margin = parseFloat(p.marginSize || "0");
    const roi = margin > 0 ? ((pnl / margin) * 100).toFixed(1) : "?";
    const sym = symShort(p.symbol);
    const side = (p.holdSide || "").toUpperCase();
    const result = pnl > 0 ? "WIN" : pnl < 0 ? "LOSS" : "BREAK";
    const date = new Date(parseInt(p.closeTime || p.openTime || "0")).toISOString().slice(0, 10);

    const memo = memoMap.get(p.positionId);
    const memoStr = memo
      ? [
          memo.reason && `진입이유: ${memo.reason}`,
          memo.exitReason && `청산이유: ${memo.exitReason}`,
          memo.psych && `심리: ${memo.psych}`,
          memo.external && `외부변수: ${memo.external}`,
          memo.text && `메모: ${memo.text}`,
        ]
          .filter(Boolean)
          .join(" / ")
      : "메모 없음";

    lines.push(
      `[${date}] ${sym} ${side} | PnL: ${pnl.toFixed(2)} USDT (ROI ${roi}%) | ${result} | ${memoStr}`
    );
  }

  return lines.join("\n");
}
