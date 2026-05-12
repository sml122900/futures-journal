// Bitget USDT-M 선물 거래소 구현

import crypto from "crypto";
import axios from "axios";
import { BaseExchange } from "./BaseExchange";
import type { ApiCredentials, Candle, FetchRangeOptions, RawRecord } from "./types";

const BASE_URL = "https://api.bitget.com";

const TF_MS: Record<string, number> = {
  "1m": 60_000, "3m": 180_000, "5m": 300_000, "15m": 900_000,
  "30m": 1_800_000, "1H": 3_600_000, "4H": 14_400_000, "1D": 86_400_000,
};

export class BitgetExchange extends BaseExchange {
  readonly exchangeId = "bitget" as const;

  constructor(credentials: ApiCredentials) {
    super(credentials);
  }

  private async request(method: string, path: string, params?: Record<string, string>) {
    const timestamp = Date.now().toString();
    const queryString = params ? "?" + new URLSearchParams(params).toString() : "";
    const requestPath = path + queryString;
    const message = timestamp + method.toUpperCase() + requestPath;
    const sign = crypto.createHmac("sha256", this.credentials.secretKey).update(message).digest("base64");

    const { data } = await axios({
      method,
      url: BASE_URL + requestPath,
      headers: {
        "ACCESS-KEY": this.credentials.apiKey,
        "ACCESS-SIGN": sign,
        "ACCESS-TIMESTAMP": timestamp,
        "ACCESS-PASSPHRASE": this.credentials.passphrase ?? "",
        "Content-Type": "application/json",
        locale: "ko-KR",
      },
    });
    return data;
  }

  async getBalance(): Promise<RawRecord> {
    const data = await this.request("GET", "/api/v2/mix/account/accounts", { productType: "USDT-FUTURES" });
    return data?.data?.[0] ?? {};
  }

  async getPositions(): Promise<RawRecord[]> {
    const data = await this.request("GET", "/api/v2/mix/position/all-position", { productType: "USDT-FUTURES" });
    return data?.data ?? [];
  }

  async getOrders(opts: FetchRangeOptions): Promise<RawRecord[]> {
    const params: Record<string, string> = {
      productType: "USDT-FUTURES",
      limit: String(opts.limit ?? 100),
      startTime: String(opts.startTime),
      endTime: String(opts.endTime),
    };
    if (opts.idLessThan) params.idLessThan = opts.idLessThan;

    const data = await this.request("GET", "/api/v2/mix/order/fills", params);
    return data?.data?.fillList || data?.data?.fills || [];
  }

  async getClosedPositions(opts: FetchRangeOptions): Promise<RawRecord[]> {
    const params: Record<string, string> = {
      productType: "USDT-FUTURES",
      limit: String(opts.limit ?? 100),
      startTime: String(opts.startTime),
      endTime: String(opts.endTime),
    };
    if (opts.idLessThan) params.idLessThan = opts.idLessThan;

    const data = await this.request("GET", "/api/v2/mix/position/history-position", params);
    return data?.data?.list ?? [];
  }

  async getCandles(symbol: string, interval: string, opts: FetchRangeOptions): Promise<Candle[]> {
    const tfMs = TF_MS[interval] ?? 300_000;
    const maxSpan = 1000 * tfMs;
    const chunks: { s: number; e: number }[] = [];
    let cur = opts.startTime;
    while (cur < opts.endTime) {
      chunks.push({ s: cur, e: Math.min(cur + maxSpan, opts.endTime) });
      cur += maxSpan;
    }

    const results = await Promise.all(
      chunks.map(({ s, e }) =>
        this.request("GET", "/api/v2/mix/market/candles", {
          symbol, productType: "USDT-FUTURES", granularity: interval,
          startTime: String(s), endTime: String(e), limit: "1000",
        }).then((data) => {
          const list: string[][] = data?.data ?? [];
          return list.map(c => ({
            time: Math.floor(parseInt(c[0]) / 1000),
            open: parseFloat(c[1]), high: parseFloat(c[2]),
            low: parseFloat(c[3]), close: parseFloat(c[4]),
            volume: parseFloat(c[5]),
          }));
        })
      )
    );

    const seen = new Set<number>();
    return results.flat()
      .filter(c => { if (seen.has(c.time)) return false; seen.add(c.time); return true; })
      .sort((a, b) => a.time - b.time);
  }
}
