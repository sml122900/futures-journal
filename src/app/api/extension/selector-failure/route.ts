// POST /api/extension/selector-failure — DOM 셀렉터 실패 보고 (인증 불필요)

import { NextRequest, NextResponse } from "next/server";
import { sendTelegramMessage } from "@/lib/telegram";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { page, timestamp, domSample } = body;

    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (adminChatId) {
      const msg = [
        "🔴 *\\[Extension\\] 셀렉터 실패*",
        `페이지: ${String(page || "unknown").substring(0, 200)}`,
        `시각: ${timestamp ? new Date(timestamp).toISOString() : "unknown"}`,
      ].join("\n");

      await sendTelegramMessage(adminChatId, msg, { parseMode: "MarkdownV2" }).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
