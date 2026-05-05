// API 키 저장/조회 (AES-256-GCM 암호화)
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { encrypt } from "@/lib/encrypt";

/** API 키 등록 여부 확인 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const apiKey = await prisma.apiKey.findUnique({
      where: { userId: session.user.id },
      select: { id: true, createdAt: true, updatedAt: true },
    });

    return NextResponse.json({
      success: true,
      data: { hasKey: !!apiKey, ...apiKey },
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

    const { apiKey, apiSecret, passphrase } = await req.json();

    if (!apiKey || !apiSecret || !passphrase) {
      return NextResponse.json(
        { success: false, message: "API 키, 시크릿, 패스프레이즈는 필수입니다" },
        { status: 400 }
      );
    }

    const saved = await prisma.apiKey.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        encryptedKey: encrypt(apiKey),
        encryptedSecret: encrypt(apiSecret),
        encryptedPass: encrypt(passphrase),
      },
      update: {
        encryptedKey: encrypt(apiKey),
        encryptedSecret: encrypt(apiSecret),
        encryptedPass: encrypt(passphrase),
      },
      select: { id: true, updatedAt: true },
    });

    return NextResponse.json({ success: true, data: saved });
  } catch (error) {
    console.error("[api-key POST]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}
