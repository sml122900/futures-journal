import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/** DELETE /api/devices/:id — 디바이스 해제 (웹 앱) */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const { id } = await params;

    const device = await prisma.deviceRegistration.findUnique({ where: { id } });
    if (!device || device.userId !== session.user.id) {
      return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });
    }

    await prisma.deviceRegistration.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[devices DELETE]", error);
    return NextResponse.json({ success: false, message: "서버 오류" }, { status: 500 });
  }
}
