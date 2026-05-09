// 회원가입 API
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { SIGNUP_BONUS } from "@/lib/credits";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password || !name) {
      return NextResponse.json(
        { success: false, message: "이메일, 비밀번호, 이름은 필수입니다" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { success: false, message: "이미 사용 중인 이메일입니다" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name, credits: SIGNUP_BONUS },
      select: { id: true, email: true, name: true },
    });

    return NextResponse.json({ success: true, data: user }, { status: 201 });
  } catch (error) {
    console.error("[register]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}
