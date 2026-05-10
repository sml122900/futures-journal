// Excel 내보내기 API (exceljs)
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getDecryptedCredentials, bitgetRequest } from "@/lib/bitget";
import ExcelJS from "exceljs";

function fmtTs(ms: string | number) {
  if (!ms) return "";
  return new Date(Number(ms)).toLocaleString("ko-KR");
}

function pnlColor(val: number): string {
  if (val > 0) return "FF22C55E"; // green-500
  if (val < 0) return "FFEF4444"; // red-500
  return "FF94A3B8";              // slate-400
}

/**
 * GET /api/export/excel?from=ISO&to=ISO
 * 시트: 포지션 / 주문 / 메모 / 월별 요약
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "인증 필요" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const from  = searchParams.get("from");
    const to    = searchParams.get("to");
    const fromMs = from ? new Date(from).getTime() : Date.now() - 90 * 86400000;
    const toMs   = to   ? new Date(to).getTime()   : Date.now();

    const credentials = await getDecryptedCredentials(session.user.id);
    if (!credentials) {
      return NextResponse.json({ success: false, message: "API 키를 먼저 등록해주세요" }, { status: 400 });
    }

    // 데이터 수집
    const [posRes, memos] = await Promise.all([
      bitgetRequest(credentials, "GET", "/api/v2/mix/position/history-position", {
        productType: "USDT-FUTURES", limit: "100",
        startTime: String(fromMs), endTime: String(toMs),
      }),
      prisma.memo.findMany({
        where: {
          userId: session.user.id,
          updatedAt: { gte: new Date(fromMs), lte: new Date(toMs) },
        },
      }),
    ]);

    const positions = (posRes?.data?.list ?? []) as Record<string, unknown>[];

    const wb = new ExcelJS.Workbook();
    wb.creator = "Futures Journal";
    wb.created = new Date();

    const headerFill: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FF94A3B8" }, size: 10 };

    function styleHeader(ws: ExcelJS.Worksheet) {
      ws.getRow(1).eachCell((cell) => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.alignment = { vertical: "middle" };
      });
      ws.getRow(1).height = 22;
    }

    // ── 시트 1: 포지션 ─────────────────────────────────────────────────────────
    const wsPos = wb.addWorksheet("포지션");
    wsPos.columns = [
      { header: "종료일",      key: "closeTime",     width: 18 },
      { header: "심볼",        key: "symbol",         width: 10 },
      { header: "방향",        key: "holdSide",       width: 8  },
      { header: "진입가",      key: "openAvgPrice",   width: 12 },
      { header: "청산가",      key: "closeAvgPrice",  width: 12 },
      { header: "마진",        key: "marginSize",     width: 10 },
      { header: "순손익(U)",   key: "netProfit",      width: 12 },
      { header: "레버리지",    key: "leverage",       width: 10 },
    ];
    styleHeader(wsPos);

    positions.forEach((p) => {
      const net = parseFloat(String(p.netProfit ?? 0));
      const row = wsPos.addRow({
        closeTime:    fmtTs(p.closeTime as string),
        symbol:       String(p.symbol ?? "").replace("USDT", ""),
        holdSide:     p.holdSide,
        openAvgPrice: parseFloat(String(p.openAvgPrice ?? 0)),
        closeAvgPrice:parseFloat(String(p.closeAvgPrice ?? 0)),
        marginSize:   parseFloat(String(p.marginSize ?? 0)),
        netProfit:    net,
        leverage:     p.leverage,
      });
      const netCell = row.getCell("netProfit");
      netCell.font = { color: { argb: pnlColor(net) }, bold: true };
      netCell.numFmt = "+0.00;-0.00;0.00";
    });

    // ── 시트 2: 메모 ───────────────────────────────────────────────────────────
    const wsMemo = wb.addWorksheet("메모");
    wsMemo.columns = [
      { header: "포지션ID",   key: "positionId",  width: 24 },
      { header: "진입이유",   key: "reason",      width: 30 },
      { header: "청산이유",   key: "exitReason",  width: 30 },
      { header: "심리상태",   key: "psych",       width: 20 },
      { header: "외부변수",   key: "external",    width: 20 },
      { header: "자유메모",   key: "text",        width: 40 },
      { header: "수정일",     key: "updatedAt",   width: 18 },
    ];
    styleHeader(wsMemo);
    memos.forEach((m) => {
      wsMemo.addRow({
        positionId: m.positionId,
        reason:     m.reason,
        exitReason: m.exitReason,
        psych:      m.psych,
        external:   m.external,
        text:       m.text,
        updatedAt:  m.updatedAt.toLocaleString("ko-KR"),
      });
    });

    // ── 시트 3: 월별 요약 ──────────────────────────────────────────────────────
    const wsMonth = wb.addWorksheet("월별 요약");
    wsMonth.columns = [
      { header: "월",          key: "month",      width: 12 },
      { header: "거래수",      key: "trades",     width: 8  },
      { header: "승률(%)",     key: "winRate",    width: 10 },
      { header: "순손익(U)",   key: "pnl",        width: 12 },
    ];
    styleHeader(wsMonth);

    // 월별 집계
    const monthMap = new Map<string, { trades: number; wins: number; pnl: number }>();
    positions.forEach((p) => {
      const t = parseInt(String(p.closeTime ?? 0));
      if (!t) return;
      const key = new Date(t).toISOString().slice(0, 7); // "2026-05"
      const net = parseFloat(String(p.netProfit ?? 0));
      const prev = monthMap.get(key) ?? { trades: 0, wins: 0, pnl: 0 };
      monthMap.set(key, { trades: prev.trades + 1, wins: prev.wins + (net > 0 ? 1 : 0), pnl: prev.pnl + net });
    });

    Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([month, v]) => {
        const pnl = parseFloat(v.pnl.toFixed(2));
        const row = wsMonth.addRow({
          month,
          trades:  v.trades,
          winRate: parseFloat(((v.wins / v.trades) * 100).toFixed(1)),
          pnl,
        });
        const pnlCell = row.getCell("pnl");
        pnlCell.font = { color: { argb: pnlColor(pnl) }, bold: true };
        pnlCell.numFmt = "+0.00;-0.00;0.00";
      });

    // 버퍼로 변환
    const buffer = await wb.xlsx.writeBuffer();
    const dateStr = new Date().toISOString().slice(0, 10);

    return new NextResponse(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="futures-journal-${dateStr}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("[export/excel]", error);
    return NextResponse.json({ success: false, message: "Excel 생성 실패" }, { status: 500 });
  }
}
