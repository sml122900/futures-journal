// 거래소 공통 타입 정의

export type ExchangeId = "bitget" | "binance";

export interface ApiCredentials {
  apiKey: string;
  secretKey: string;
  passphrase?: string;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FetchRangeOptions {
  startTime: number;
  endTime: number;
  idLessThan?: string;
  limit?: number;
}

// 대시보드 파서와 호환되는 Bitget 필드명 기반 공통 레코드 타입
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RawRecord = Record<string, any>;
