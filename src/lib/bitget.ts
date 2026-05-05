// 비트겟 USDT-M 선물 API 서명 및 요청 유틸
import crypto from "crypto";
import axios from "axios";
import prisma from "./prisma";
import { decrypt } from "./encrypt";

const BASE_URL = "https://api.bitget.com";

export interface BitgetCredentials {
  apiKey: string;
  apiSecret: string;
  passphrase: string;
}

/** HMAC-SHA256 서명: timestamp + method + requestPath + body */
function createSign(
  timestamp: string,
  method: string,
  requestPath: string,
  body: string,
  secret: string
): string {
  const message = timestamp + method.toUpperCase() + requestPath + body;
  return crypto.createHmac("sha256", secret).update(message).digest("base64");
}

/** 비트겟 API 요청 */
export async function bitgetRequest(
  credentials: BitgetCredentials,
  method: string,
  path: string,
  params?: Record<string, string>
) {
  const timestamp = Date.now().toString();
  const queryString = params ? "?" + new URLSearchParams(params).toString() : "";
  const requestPath = path + queryString;
  const body = "";

  const sign = createSign(timestamp, method, requestPath, body, credentials.apiSecret);

  const { data } = await axios({
    method,
    url: BASE_URL + requestPath,
    headers: {
      "ACCESS-KEY": credentials.apiKey,
      "ACCESS-SIGN": sign,
      "ACCESS-TIMESTAMP": timestamp,
      "ACCESS-PASSPHRASE": credentials.passphrase,
      "Content-Type": "application/json",
      locale: "ko-KR",
    },
  });

  return data;
}

/** DB에서 사용자 API 키를 조회하고 복호화하여 반환 */
export async function getDecryptedCredentials(
  userId: string
): Promise<BitgetCredentials | null> {
  const apiKey = await prisma.apiKey.findUnique({ where: { userId } });
  if (!apiKey) return null;

  return {
    apiKey: decrypt(apiKey.encryptedKey),
    apiSecret: decrypt(apiKey.encryptedSecret),
    passphrase: decrypt(apiKey.encryptedPass),
  };
}
