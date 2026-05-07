// 회원정보 수정 API (이름, 비밀번호)
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const { name, currentPassword, newPassword } = await req.json();

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) return NextResponse.json({ success: false, message: "사용자 없음" }, { status: 404 });

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return NextResponse.json({ success: false, message: "현재 비밀번호가 올바르지 않습니다" }, { status: 400 });
    }

    const updateData: { name?: string; password?: string } = {};
    if (name?.trim()) updateData.name = name.trim();
    if (newPassword) {
      if (newPassword.length < 8) {
        return NextResponse.json({ success: false, message: "새 비밀번호는 8자 이상이어야 합니다" }, { status: 400 });
      }
      updateData.password = await bcrypt.hash(newPassword, 12);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, message: "변경할 내용이 없습니다" }, { status: 400 });
    }

    await prisma.user.update({ where: { id: session.user.id }, data: updateData });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[user/profile]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}
