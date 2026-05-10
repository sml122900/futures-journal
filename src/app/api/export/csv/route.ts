// CSV 내보내기 API
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getDecryptedCredentials, bitgetRequest } from "@/lib/bitget";

type ExportType = "orders" | "positions" | "memos";

/** JSON 배열 → CSV 문자열 */
function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ];
  return lines.join("\r\n");
}

function fmtTs(ms: string | number) {
  if (!ms) return "";
  return new Date(Number(ms)).toISOString();
}

/**
 * GET /api/export/csv?type=orders|positions|memos&from=ISO&to=ISO
 * Content-Disposition: attachment; filename="..."
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = (searchParams.get("type") ?? "positions") as ExportType;
    const from = searchParams.get("from");
    const to   = searchParams.get("to");

    const fromMs = from ? new Date(from).getTime() : 0;
    const toMs   = to   ? new Date(to).getTime()   : Date.now();

    let csv = "";
    let filename = `futures-journal-${type}`;

    if (type === "memos") {
      const memos = await prisma.memo.findMany({
        where: {
          userId: session.user.id,
          updatedAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to   ? { lte: new Date(to)   } : {}),
          },
        },
        orderBy: { updatedAt: "desc" },
      });
      csv = toCsv(memos.map((m) => ({
        positionId: m.positionId,
        reason:     m.reason,
        exitReason: m.exitReason,
        psych:      m.psych,
        external:   m.external,
        text:       m.text,
        updatedAt:  m.updatedAt.toISOString(),
      })));
    } else {
      const credentials = await getDecryptedCredentials(session.user.id);
      if (!credentials) {
        return NextResponse.json({ success: false, message: "API 키를 먼저 등록해주세요" }, { status: 400 });
      }

      if (type === "positions") {
        const res = await bitgetRequest(credentials, "GET", "/api/v2/mix/position/history-position", {
          productType: "USDT-FUTURES",
          limit: "100",
          ...(from ? { startTime: String(fromMs) } : {}),
          ...(to   ? { endTime:   String(toMs)   } : {}),
        });
        const list = (res?.data?.list ?? []) as Record<string, unknown>[];
        csv = toCsv(list.map((p) => ({
          positionId:      p.positionId,
          symbol:          p.symbol,
          holdSide:        p.holdSide,
          openAvgPrice:    p.openAvgPrice,
          closeAvgPrice:   p.closeAvgPrice,
          marginSize:      p.marginSize,
          netProfit:       p.netProfit,
          openTime:        fmtTs(p.openTime as string),
          closeTime:       fmtTs(p.closeTime as string),
          leverage:        p.leverage,
        })));
      } else {
        // orders
        const res = await bitgetRequest(credentials, "GET", "/api/v2/mix/order/fills", {
          productType: "USDT-FUTURES",
          limit: "100",
          ...(from ? { startTime: String(fromMs) } : {}),
          ...(to   ? { endTime:   String(toMs)   } : {}),
        });
        const list = (res?.data?.fillList ?? res?.data ?? []) as Record<string, unknown>[];
        csv = toCsv(list.map((o) => ({
          orderId:  o.orderId,
          symbol:   o.symbol,
          side:     o.side,
          price:    o.price ?? o.priceAvg,
          size:     o.baseVolume ?? o.size,
          profit:   o.profit ?? o.totalProfits,
          fee:      o.fee,
          cTime:    fmtTs(o.cTime as string),
        })));
      }
    }

    if (!csv) {
      return NextResponse.json({ success: false, message: "내보낼 데이터가 없습니다" }, { status: 404 });
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    filename = `${filename}-${dateStr}.csv`;

    return new NextResponse("﻿" + csv, {  // BOM: Excel 한글 깨짐 방지
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[export/csv]", error);
    return NextResponse.json({ success: false, message: "CSV 생성 실패" }, { status: 500 });
  }
}
