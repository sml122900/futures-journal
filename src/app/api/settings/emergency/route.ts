// /api/settings/emergency — /api/trigger-settings 로 이전됨
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "이 엔드포인트는 /api/trigger-settings 로 이전되었습니다." }, { status: 410 });
}
export async function PUT() {
  return NextResponse.json({ message: "이 엔드포인트는 /api/trigger-settings 로 이전되었습니다." }, { status: 410 });
}
