// 사용자 베이스라인 갱신 Cron (매일 KST 00:00 = UTC 15:00)
// vercel.json: "0 15 * * *"
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { recalculateBaseline } from "@/lib/baseline-calculator";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    where: { apiKeys: { some: {} } },
    select: { id: true, apiKeys: { select: { exchange: true } } },
  });

  let updated = 0;
  let errors = 0;

  for (const user of users) {
    for (const apiKey of user.apiKeys) {
      try {
        const result = await recalculateBaseline(user.id, apiKey.exchange);
        if (result) updated++;
      } catch (e) {
        console.error(`[baseline-update] userId=${user.id} exchange=${apiKey.exchange}`, e);
        errors++;
      }
    }
  }

  return NextResponse.json({ success: true, updated, errors });
}
