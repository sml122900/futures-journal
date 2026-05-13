// 매매 회고 리마인더 Cron (매일 KST 08:00 = UTC 23:00 전날)
// vercel.json: "0 23 * * *"
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";

const APP_URL = process.env.NEXTAUTH_URL ?? "https://futures-journal.vercel.app";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? new URL(req.url).searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  let sent = 0;
  let errors = 0;

  try {
    // memoReminder ON + 텔레그램 연동된 사용자
    const settings = await prisma.notificationSetting.findMany({
      where: { telegramLinked: true, memoReminder: true, telegramChatId: { not: null } },
      select: { userId: true, telegramChatId: true },
    });

    // 어제 KST 00:00 ~ 23:59 → UTC 기준으로 변환
    // KST = UTC+9 이므로 KST 00:00 = UTC 전날 15:00
    const KST_OFFSET = 9 * 60 * 60 * 1000;
    const kstNow = new Date(Date.now() + KST_OFFSET);
    kstNow.setUTCHours(0, 0, 0, 0); // KST 오늘 자정 (UTC 기준 시각)
    const kstTodayMidnightUTC = kstNow.getTime() - KST_OFFSET;
    const yesterdayStartUTC = new Date(kstTodayMidnightUTC - 24 * 60 * 60 * 1000);
    const yesterdayEndUTC   = new Date(kstTodayMidnightUTC);

    for (const ns of settings) {
      if (!ns.telegramChatId) continue;
      try {
        // 어제 작성된 실질 메모(내용 있는 것) 수 확인
        const memoCount = await prisma.memo.count({
          where: {
            userId: ns.userId,
            createdAt: { gte: yesterdayStartUTC, lt: yesterdayEndUTC },
            OR: [
              { text: { not: "" } },
              { reason: { not: "" } },
              { exitReason: { not: "" } },
            ],
          },
        });

        if (memoCount === 0) {
          await sendTelegramMessage(
            ns.telegramChatId,
            `📝 *매매 회고 리마인더*\n\n어제 매매 기록을 아직 작성하지 않으셨네요\\.\n\n기억이 생생할 때 남긴 회고가 가장 가치 있습니다\\.`,
            {
              parseMode: "MarkdownV2",
              inlineKeyboard: [[{ text: "📖 메모 작성하기", url: `${APP_URL}/dashboard` }]],
            }
          );
          sent++;
        }
      } catch (userErr) {
        console.error(`[cron/memo-reminders] userId=${ns.userId}`, userErr);
        errors++;
      }
    }

    return NextResponse.json({ success: true, sent, errors });
  } catch (err) {
    console.error("[cron/memo-reminders]", err);
    return NextResponse.json({ success: false, message: "Cron 실행 실패" }, { status: 500 });
  }
}
