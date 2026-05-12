// 거래소 추상 클래스 — 모든 거래소가 구현해야 할 메서드 정의

import type { ApiCredentials, Candle, FetchRangeOptions, RawRecord, ExchangeId } from "./types";

export abstract class BaseExchange {
  protected credentials: ApiCredentials;
  abstract readonly exchangeId: ExchangeId;

  constructor(credentials: ApiCredentials) {
    this.credentials = credentials;
  }

  // 잔고 — Bitget 호환 필드명: { usdtEquity, available, unrealizedPL, marginRate }
  abstract getBalance(): Promise<RawRecord>;

  // 현재 오픈 포지션 — Bitget 호환 필드명 배열
  abstract getPositions(): Promise<RawRecord[]>;

  // 체결 주문 내역 — Bitget 호환 필드명 배열
  abstract getOrders(opts: FetchRangeOptions): Promise<RawRecord[]>;

  // 종료 포지션 내역 — Bitget 호환 필드명 배열
  abstract getClosedPositions(opts: FetchRangeOptions): Promise<RawRecord[]>;

  // 캔들 데이터
  abstract getCandles(symbol: string, interval: string, opts: FetchRangeOptions): Promise<Candle[]>;
}
