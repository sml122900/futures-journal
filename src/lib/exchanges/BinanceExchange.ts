// Binance USDT-M 선물 거래소 구현

import crypto from "crypto";
import { BaseExchange } from "./BaseExchange";
import type { ApiCredentials, Candle, FetchRangeOptions, RawRecord } from "./types";

const BASE_URL = "https://fapi.binance.com";

// Bitget TF → Binance interval 변환
const TF_MAP: Record<string, string> = {
  "1m": "1m", "3m": "3m", "5m": "5m", "15m": "15m",
  "30m": "30m", "1H": "1h", "4H": "4h", "1D": "1d",
};

const TF_MS: Record<string, number> = {
  "1m": 60_000, "3m": 180_000, "5m": 300_000, "15m": 900_000,
  "30m": 1_800_000, "1H": 3_600_000, "4H": 14_400_000, "1D": 86_400_000,
};

export class BinanceExchange extends BaseExchange {
  readonly exchangeId = "binance" as const;

  constructor(credentials: ApiCredentials) {
    super(credentials);
  }

  private sign(queryString: string): string {
    return crypto.createHmac("sha256", this.credentials.secretKey).update(queryString).digest("hex");
  }

  private async signedRequest(path: string, params: Record<string, string | number> = {}): Promise<unknown> {
    params.timestamp = Date.now();
    params.recvWindow = 5000;
    const queryString = new URLSearchParams(
      Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
    ).toString();
    const signature = this.sign(queryString);
    const url = `${BASE_URL}${path}?${queryString}&signature=${signature}`;

    const res = await fetch(url, {
      headers: { "X-MBX-APIKEY": this.credentials.apiKey },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Binance API ${res.status}: ${(err as { msg?: string }).msg ?? res.statusText}`);
    }
    return res.json();
  }

  async getBalance(): Promise<RawRecord> {
    const data = await this.signedRequest("/fapi/v2/account") as Record<string, string>;
    const equity = parseFloat(data.totalMarginBalance ?? "0");
    const maint = parseFloat(data.totalMaintMargin ?? "0");
    return {
      usdtEquity: data.totalMarginBalance ?? "0",
      available: data.availableBalance ?? "0",
      unrealizedPL: data.totalUnrealizedProfit ?? "0",
      marginRate: equity > 0 ? String((maint / equity * 100).toFixed(2)) : "0",
    };
  }

  async getPositions(): Promise<RawRecord[]> {
    const data = await this.signedRequest("/fapi/v2/positionRisk") as RawRecord[];
    return data
      .filter((p) => parseFloat(p.positionAmt ?? "0") !== 0)
      .map((p) => {
        const amt = parseFloat(p.positionAmt);
        const side = amt > 0 ? "long" : "short";
        const notional = Math.abs(parseFloat(p.notional ?? "0"));
        const lev = parseFloat(p.leverage ?? "1");
        return {
          symbol: p.symbol,
          holdSide: side,
          openPriceAvg: p.entryPrice,
          markPrice: p.markPrice,
          liquidationPrice: p.liquidationPrice,
          leverage: p.leverage,
          total: String(Math.abs(amt)),
          size: String(Math.abs(amt)),
          achievedProfits: p.unRealizedProfit,
          marginSize: lev > 0 ? String((notional / lev).toFixed(4)) : "0",
          unrealizedPL: p.unRealizedProfit,
          ctime: p.updateTime,
          utime: p.updateTime,
        };
      });
  }

  async getOrders(opts: FetchRangeOptions): Promise<RawRecord[]> {
    const params: Record<string, string | number> = {
      startTime: opts.startTime,
      endTime: opts.endTime,
      limit: opts.limit ?? 1000,
    };
    // Binance requires symbol — use without symbol to get all symbols (may require pagination per symbol)
    // fromId equivalent is `fromId` param (trade id based, not time based)
    const data = await this.signedRequest("/fapi/v1/userTrades", params) as RawRecord[];

    return data.map((t) => {
      const posSide = t.positionSide as string;
      const side = (t.side as string).toUpperCase();
      let holdSide: string;
      if (posSide === "LONG") holdSide = "long";
      else if (posSide === "SHORT") holdSide = "short";
      else holdSide = side === "BUY" ? "long" : "short";

      let tradeSide: string;
      if (posSide === "LONG") tradeSide = side === "BUY" ? "open" : "close";
      else if (posSide === "SHORT") tradeSide = side === "SELL" ? "open" : "close";
      else tradeSide = side === "BUY" ? "open" : "close";

      return {
        tradeId: String(t.id),
        orderId: String(t.orderId),
        symbol: t.symbol,
        posSide: holdSide,
        tradeSide,
        price: t.price,
        priceAvg: t.price,
        baseVolume: t.qty,
        size: t.qty,
        totalProfits: t.realizedPnl,
        profit: t.realizedPnl,
        fee: t.commission,
        feeDetail: null,
        cTime: String(t.time),
        createTime: String(t.time),
      };
    });
  }

  async getClosedPositions(opts: FetchRangeOptions): Promise<RawRecord[]> {
    // 1단계: 실현 PnL income 항목 조회
    const incomeData = await this.signedRequest("/fapi/v1/income", {
      incomeType: "REALIZED_PNL",
      startTime: opts.startTime,
      endTime: opts.endTime,
      limit: opts.limit ?? 1000,
    }) as RawRecord[];

    const pnlEntries = incomeData.filter((e) => parseFloat(e.income ?? "0") !== 0);
    if (pnlEntries.length === 0) return [];

    // 2단계: 심볼별 체결 내역 조회 (방향 파악)
    const symbols = [...new Set(pnlEntries.map((e) => e.symbol as string))].slice(0, 15);
    const tradesBySymbol = new Map<string, RawRecord[]>();

    await Promise.all(symbols.map(async (sym) => {
      try {
        const trades = await this.signedRequest("/fapi/v1/userTrades", {
          symbol: sym,
          startTime: opts.startTime,
          endTime: opts.endTime,
          limit: 1000,
        }) as RawRecord[];
        tradesBySymbol.set(sym, trades);
      } catch { tradesBySymbol.set(sym, []); }
    }));

    // 3단계: income 항목과 체결 내역 매칭으로 방향/청산가 확정
    return pnlEntries.map((entry) => {
      const trades = tradesBySymbol.get(entry.symbol) ?? [];

      // tradeId로 먼저 매칭, 없으면 시각 기준 ±5초 내 청산 체결
      const matched = trades.find((t) =>
        String(t.id) === String(entry.tradeId) ||
        (Math.abs(Number(t.time) - Number(entry.time)) < 5000 &&
         parseFloat(t.realizedPnl ?? "0") !== 0)
      );

      let holdSide = "long";
      let closeAvgPrice = "0";
      let closeTotalPos = "0";

      if (matched) {
        const posSide = (matched.positionSide as string ?? "BOTH").toUpperCase();
        const side    = (matched.side as string ?? "SELL").toUpperCase();
        // HEDGE 모드: positionSide 직접 사용
        // ONE-WAY 모드: SELL이 롱 청산, BUY가 숏 청산
        if (posSide === "LONG")       holdSide = "long";
        else if (posSide === "SHORT") holdSide = "short";
        else holdSide = side === "SELL" ? "long" : "short";

        closeAvgPrice = String(matched.price ?? "0");
        closeTotalPos = String(matched.qty ?? "0");
      }

      return {
        positionId: String(entry.tranId),
        symbol: entry.symbol,
        holdSide,
        openAvgPrice: "0",
        closeAvgPrice,
        closeTotalPos,
        openTotalPos: closeTotalPos,
        netProfit: entry.income,
        cumRealisedPnl: entry.income,
        totalFunding: "0",
        openFeeTotal: "0",
        closeFeeTotal: "0",
        openTime: String(entry.time),
        utime: String(entry.time),
        updatedTime: String(entry.time),
        ctime: String(entry.time),
      };
    });
  }

  async getCandles(symbol: string, interval: string, opts: FetchRangeOptions): Promise<Candle[]> {
    const binanceInterval = TF_MAP[interval] ?? "5m";
    const tfMs = TF_MS[interval] ?? 300_000;
    const maxSpan = 1500 * tfMs;

    const chunks: { s: number; e: number }[] = [];
    let cur = opts.startTime;
    while (cur < opts.endTime) {
      chunks.push({ s: cur, e: Math.min(cur + maxSpan, opts.endTime) });
      cur += maxSpan;
    }

    const results = await Promise.all(
      chunks.map(async ({ s, e }) => {
        const qs = new URLSearchParams({
          symbol, interval: binanceInterval,
          startTime: String(s), endTime: String(e), limit: "1500",
        }).toString();
        const res = await fetch(`${BASE_URL}/fapi/v1/klines?${qs}`);
        const list = await res.json() as string[][];
        return list.map(c => ({
          time: Math.floor(parseInt(c[0]) / 1000),
          open: parseFloat(c[1]), high: parseFloat(c[2]),
          low: parseFloat(c[3]), close: parseFloat(c[4]),
          volume: parseFloat(c[5]),
        }));
      })
    );

    const seen = new Set<number>();
    return results.flat()
      .filter(c => { if (seen.has(c.time)) return false; seen.add(c.time); return true; })
      .sort((a, b) => a.time - b.time);
  }
}
