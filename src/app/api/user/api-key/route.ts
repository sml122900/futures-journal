// API 키 저장/조회 (AES-256-GCM 암호화)
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { encrypt } from "@/lib/encrypt";
import { isValidExchange } from "@/lib/exchanges";

/** API 키 등록 여부 확인 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const apiKeys = await prisma.apiKey.findMany({
      where: { userId: session.user.id },
      select: { id: true, exchange: true, createdAt: true, updatedAt: true },
    });

    return NextResponse.json({
      success: true,
      data: { hasKey: apiKeys.length > 0, keys: apiKeys },
    });
  } catch (error) {
    console.error("[api-key GET]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}

/** API 키 저장 (암호화 후 DB upsert) */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const { exchange, apiKey, apiSecret, passphrase = "" } = await req.json();

    if (!exchange || !isValidExchange(exchange)) {
      return NextResponse.json({ success: false, message: "유효하지 않은 거래소입니다" }, { status: 400 });
    }
    if (!apiKey || !apiSecret) {
      return NextResponse.json({ success: false, message: "API Key와 Secret Key는 필수입니다" }, { status: 400 });
    }

    const saved = await prisma.apiKey.upsert({
      where: { userId_exchange: { userId: session.user.id, exchange } },
      create: {
        userId: session.user.id,
        exchange,
        encryptedKey: encrypt(apiKey),
        encryptedSecret: encrypt(apiSecret),
        encryptedPass: passphrase ? encrypt(passphrase) : "",
      },
      update: {
        encryptedKey: encrypt(apiKey),
        encryptedSecret: encrypt(apiSecret),
        encryptedPass: passphrase ? encrypt(passphrase) : "",
      },
      select: { id: true, exchange: true, updatedAt: true },
    });

    return NextResponse.json({ success: true, data: saved });
  } catch (error) {
    console.error("[api-key POST]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}
