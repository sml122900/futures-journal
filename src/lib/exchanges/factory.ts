// 거래소 인스턴스 생성 팩토리

import { BitgetExchange } from "./BitgetExchange";
import { BinanceExchange } from "./BinanceExchange";
import { BaseExchange } from "./BaseExchange";
import type { ApiCredentials, ExchangeId } from "./types";
import prisma from "@/lib/prisma";
import { decrypt } from "@/lib/encrypt";

export function createExchange(exchangeId: ExchangeId, credentials: ApiCredentials): BaseExchange {
  switch (exchangeId) {
    case "bitget":  return new BitgetExchange(credentials);
    case "binance": return new BinanceExchange(credentials);
    default: throw new Error(`지원하지 않는 거래소: ${exchangeId}`);
  }
}

/** DB에서 지정 거래소 API 키를 조회하고 복호화하여 거래소 인스턴스 반환 */
export async function createExchangeForUser(
  userId: string,
  exchangeId: ExchangeId
): Promise<BaseExchange | null> {
  const apiKey = await prisma.apiKey.findUnique({
    where: { userId_exchange: { userId, exchange: exchangeId } },
  });
  if (!apiKey) return null;

  const credentials: ApiCredentials = {
    apiKey: decrypt(apiKey.encryptedKey),
    secretKey: decrypt(apiKey.encryptedSecret),
    passphrase: apiKey.encryptedPass ? decrypt(apiKey.encryptedPass) : "",
  };

  return createExchange(exchangeId, credentials);
}
