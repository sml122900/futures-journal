// CSV 내보내기 API — 포지션/주문 내역을 Bitget 원본 형식 + 메모 컬럼으로 내보냄
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getDecryptedCredentials, bitgetRequest } from "@/lib/bitget";

type Credentials = NonNullable<Awaited<ReturnType<typeof getDecryptedCredentials>>>;
type ExportType = "orders" | "positions" | "memos";

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\r\n");
}

// Bitget 원본 형식과 동일한 날짜 포맷 (KST UTC+9)
function fmtTs(ms: string | number) {
  if (!ms) return "";
  const d = new Date(Number(ms) + 9 * 3600000);
  return d.toISOString().replace("T", " ").slice(0, 19);
}

// 비트겟 API는 한 번 요청에 최대 90일 범위만 허용 → 청크 분할
const CHUNK = 89 * 86400000;

function makeChunks(fromMs: number, toMs: number) {
  // from 미지정(0)이면 최대 1년 전까지만
  const start = fromMs || toMs - 365 * 86400000;
  const chunks: { s: number; e: number }[] = [];
  let e = toMs;
  while (e > start) {
    const s = Math.max(e - CHUNK, start);
    chunks.push({ s, e });
    e = s;
  }
  return chunks;
}

async function fetchAllPositions(credentials: Credentials, fromMs: number, toMs: number) {
  const results: Record<string, unknown>[] = [];
  for (const { s, e } of makeChunks(fromMs, toMs)) {
    let cursor: string | undefined;
    for (let i = 0; i < 10; i++) {
      const res = await bitgetRequest(credentials, "GET", "/api/v2/mix/position/history-position", {
        productType: "USDT-FUTURES", limit: "100",
        startTime: String(s), endTime: String(e),
        ...(cursor ? { idLessThan: cursor } : {}),
      });
      const list = (res?.data?.list ?? []) as Record<string, unknown>[];
      if (!list.length) break;
      results.push(...list);
      if (list.length < 100) break;
      cursor = String(list[list.length - 1].positionId ?? "");
    }
  }
  return results;
}

async function fetchAllFills(credentials: Credentials, fromMs: number, toMs: number) {
  const results: Record<string, unknown>[] = [];
  for (const { s, e } of makeChunks(fromMs, toMs)) {
    let cursor: string | undefined;
    for (let i = 0; i < 10; i++) {
      const res = await bitgetRequest(credentials, "GET", "/api/v2/mix/order/fills", {
        productType: "USDT-FUTURES", limit: "100",
        startTime: String(s), endTime: String(e),
        ...(cursor ? { idLessThan: cursor } : {}),
      });
      const list = (res?.data?.fillList ?? res?.data ?? []) as Record<string, unknown>[];
      if (!list.length) break;
      results.push(...list);
      if (list.length < 100) break;
      cursor = String(list[list.length - 1].orderId ?? "");
    }
  }
  return results;
}

/**
 * GET /api/export/csv?type=positions|orders|memos&from=ISO&to=ISO
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
    let filename: string = type;

    if (type === "memos") {
      const memos = await prisma.memo.findMany({
        where: {
          userId: session.user.id,
          updatedAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) },
        },
        orderBy: { updatedAt: "desc" },
      });
      csv = toCsv(memos.map((m) => ({
        positionId: m.positionId,
        reason: m.reason, exitReason: m.exitReason,
        psych: m.psych, external: m.external, text: m.text,
        updatedAt: m.updatedAt.toISOString(),
      })));
    } else {
      const credentials = await getDecryptedCredentials(session.user.id);
      if (!credentials) {
        return NextResponse.json({ success: false, message: "API 키를 먼저 등록해주세요" }, { status: 400 });
      }

      if (type === "positions") {
        const [positions, memos] = await Promise.all([
          fetchAllPositions(credentials, fromMs, toMs),
          prisma.memo.findMany({ where: { userId: session.user.id } }),
        ]);
        const memoMap = new Map(memos.map((m) => [m.positionId, m]));

        csv = toCsv(positions.map((p) => {
          const memo = memoMap.get(String(p.positionId ?? ""));
          const sym    = String(p.symbol ?? "");
          const coin   = sym.replace(/USDT.*/, "");
          const dir    = p.holdSide === "long" ? "Long" : "Short";
          const size   = parseFloat(String(p.openSizeOfCoin ?? p.totalSize ?? 0));
          const cAvg   = parseFloat(String(p.closeAvgPrice ?? 0));
          const oFee   = parseFloat(String(p.openFee  ?? 0));
          const cFee   = parseFloat(String(p.closeFee ?? 0));
          const fFee   = parseFloat(String(p.fundingFee ?? 0));
          return {
            "Futures":               `${sym} ${dir}`,
            "Margin type":           String(p.marginMode ?? "cross"),
            "Opening time":          fmtTs(p.openTime as string),
            "Average entry price":   parseFloat(String(p.openAvgPrice ?? 0)),
            "Average closing price": cAvg,
            "Closed amount":         size ? `${size}${coin}` : "",
            "Closed value":          size ? `${(size * cAvg).toFixed(4)}USDT` : "",
            "Position Pnl":          `${parseFloat(String(p.achievedProfits ?? 0)).toFixed(4)}USDT`,
            "Realized PnL":          `${parseFloat(String(p.netProfit ?? 0)).toFixed(4)}USDT`,
            "Fees":                  `${fFee.toFixed(4)}USDT`,
            "Opening fee":           `${oFee.toFixed(4)}USDT`,
            "Closing fee":           `${cFee.toFixed(4)}USDT`,
            "Closed time":           fmtTs(p.closeTime as string),
            "진입이유":               memo?.reason    ?? "",
            "청산이유":               memo?.exitReason ?? "",
            "심리상태":               memo?.psych      ?? "",
            "자유메모":               memo?.text       ?? "",
          };
        }));
        filename = "position-history";
      } else {
        const fills = await fetchAllFills(credentials, fromMs, toMs);
        csv = toCsv(fills.map((o) => ({
          "Order ID":       o.orderId,
          "Direction":      o.tradeSide ?? o.side,
          "Futures":        o.symbol,
          "Order source":   o.orderSource ?? "",
          "Transaction type": o.orderType ?? "",
          "Price":          parseFloat(String(o.price ?? 0)),
          "Average Price":  parseFloat(String(o.priceAvg ?? o.price ?? 0)),
          "Order amount":   parseFloat(String(o.size ?? 0)),
          "Executed":       parseFloat(String(o.baseVolume ?? 0)),
          "Trading volume": parseFloat(String(o.quoteVolume ?? 0)),
          "Realized P/L":   parseFloat(String(o.profit ?? o.totalProfits ?? 0)),
          "NetProfits":     parseFloat(String(o.netProfit ?? 0)),
          "Status":         o.state ?? "fully executed",
          "Time":           fmtTs(o.cTime as string),
        })));
        filename = "order-history";
      }
    }

    if (!csv) {
      return NextResponse.json({ success: false, message: "내보낼 데이터가 없습니다" }, { status: 404 });
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    return new NextResponse("﻿" + csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}-${dateStr}.csv"`,
      },
    });
  } catch (error) {
    console.error("[export/csv]", error);
    return NextResponse.json({ success: false, message: "CSV 생성 실패" }, { status: 500 });
  }
}
