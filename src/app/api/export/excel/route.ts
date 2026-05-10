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

    // 플랜 권한 체크 (pro 이상)
    const { checkFeatureAccess } = await import("@/lib/plans");
    const allowed = await checkFeatureAccess(session.user.id, "excel_export");
    if (!allowed) {
      return NextResponse.json(
        { success: false, message: "PLAN_REQUIRED", data: { required: "pro" } },
        { status: 403 }
      );
    }

    const credentials = await getDecryptedCredentials(session.user.id);
    if (!credentials) {
      return NextResponse.json({ success: false, message: "API 키를 먼저 등록해주세요" }, { status: 400 });
    }

    // 데이터 수집 (포지션 + 주문 + 메모 병렬)
    const [posRes, ordersRes, memos] = await Promise.all([
      bitgetRequest(credentials, "GET", "/api/v2/mix/position/history-position", {
        productType: "USDT-FUTURES", limit: "100",
        startTime: String(fromMs), endTime: String(toMs),
      }),
      bitgetRequest(credentials, "GET", "/api/v2/mix/order/fills", {
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
    const orders    = (ordersRes?.data?.fillList ?? ordersRes?.data ?? []) as Record<string, unknown>[];

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

    // ── 시트 4: 주문 내역 ──────────────────────────────────────────────────────
    const wsOrders = wb.addWorksheet("주문 내역");
    wsOrders.columns = [
      { header: "체결일시",    key: "cTime",      width: 18 },
      { header: "심볼",        key: "symbol",     width: 10 },
      { header: "방향",        key: "side",       width: 8  },
      { header: "수량",        key: "size",       width: 10 },
      { header: "체결가",      key: "price",      width: 12 },
      { header: "손익(U)",     key: "profit",     width: 12 },
      { header: "수수료(U)",   key: "fee",        width: 12 },
    ];
    styleHeader(wsOrders);
    orders.forEach((o) => {
      const profit = parseFloat(String(o.profit ?? o.totalProfits ?? 0));
      const row = wsOrders.addRow({
        cTime:  fmtTs(o.cTime as string),
        symbol: String(o.symbol ?? "").replace("USDT", ""),
        side:   o.side,
        size:   o.baseVolume ?? o.size,
        price:  parseFloat(String(o.price ?? o.priceAvg ?? 0)),
        profit,
        fee:    parseFloat(String(o.fee ?? 0)),
      });
      if (profit !== 0) {
        row.getCell("profit").font = { color: { argb: pnlColor(profit) }, bold: true };
        row.getCell("profit").numFmt = "+0.00;-0.00;0.00";
      }
    });

    // ── 시트 5: 세금 신고용 (월별 실현 손익) ──────────────────────────────────
    const wsTax = wb.addWorksheet("세금 신고용");
    wsTax.getCell("A1").value = "* 한국 가상자산 과세 기준: 연간 실현 손익 250만원 초과분 20% 양도세";
    wsTax.getCell("A1").font = { italic: true, color: { argb: "FF64748B" }, size: 9 };
    wsTax.addRow([]);

    wsTax.columns = [
      { header: "월",               key: "month",       width: 12 },
      { header: "포지션 수",        key: "trades",      width: 10 },
      { header: "총 수익 포지션(U)", key: "grossProfit", width: 18 },
      { header: "총 손실 포지션(U)", key: "grossLoss",   width: 18 },
      { header: "월 실현 손익(U)",   key: "netPnl",      width: 18 },
      { header: "수수료 합계(U)",    key: "totalFee",    width: 14 },
      { header: "순 실현 손익(U)",   key: "netAfterFee", width: 18 },
    ];
    wsTax.getRow(3).eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { vertical: "middle" };
    });
    wsTax.getRow(3).height = 22;

    // 월별 세금 집계 (포지션 기준)
    const taxMap = new Map<string, { trades: number; grossProfit: number; grossLoss: number; netPnl: number; totalFee: number }>();
    positions.forEach((p) => {
      const t = parseInt(String(p.closeTime ?? 0));
      if (!t) return;
      const month = new Date(t).toISOString().slice(0, 7);
      const net = parseFloat(String(p.netProfit ?? 0));
      const fee = parseFloat(String(p.openFee ?? 0)) + parseFloat(String(p.closeFee ?? 0));
      const prev = taxMap.get(month) ?? { trades: 0, grossProfit: 0, grossLoss: 0, netPnl: 0, totalFee: 0 };
      taxMap.set(month, {
        trades:      prev.trades + 1,
        grossProfit: prev.grossProfit + (net > 0 ? net : 0),
        grossLoss:   prev.grossLoss   + (net < 0 ? net : 0),
        netPnl:      prev.netPnl + net,
        totalFee:    prev.totalFee + Math.abs(fee),
      });
    });

    let cumPnl = 0;
    Array.from(taxMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([month, v]) => {
        cumPnl += v.netPnl;
        const netAfterFee = parseFloat((v.netPnl - v.totalFee).toFixed(2));
        const row = wsTax.addRow({
          month,
          trades:      v.trades,
          grossProfit: parseFloat(v.grossProfit.toFixed(2)),
          grossLoss:   parseFloat(v.grossLoss.toFixed(2)),
          netPnl:      parseFloat(v.netPnl.toFixed(2)),
          totalFee:    parseFloat(v.totalFee.toFixed(2)),
          netAfterFee,
        });
        row.getCell("netPnl").font     = { color: { argb: pnlColor(v.netPnl) }, bold: true };
        row.getCell("netAfterFee").font = { color: { argb: pnlColor(netAfterFee) }, bold: true };
        row.getCell("netPnl").numFmt     = "+0.00;-0.00;0.00";
        row.getCell("netAfterFee").numFmt = "+0.00;-0.00;0.00";
      });

    // 합계 행
    const totalRow = wsTax.addRow({
      month: "합계",
      trades: Array.from(taxMap.values()).reduce((s, v) => s + v.trades, 0),
      grossProfit: parseFloat(Array.from(taxMap.values()).reduce((s, v) => s + v.grossProfit, 0).toFixed(2)),
      grossLoss:   parseFloat(Array.from(taxMap.values()).reduce((s, v) => s + v.grossLoss, 0).toFixed(2)),
      netPnl:      parseFloat(cumPnl.toFixed(2)),
      totalFee:    parseFloat(Array.from(taxMap.values()).reduce((s, v) => s + v.totalFee, 0).toFixed(2)),
      netAfterFee: parseFloat((cumPnl - Array.from(taxMap.values()).reduce((s, v) => s + v.totalFee, 0)).toFixed(2)),
    });
    totalRow.font = { bold: true };
    totalRow.getCell("netPnl").numFmt     = "+0.00;-0.00;0.00";
    totalRow.getCell("netAfterFee").numFmt = "+0.00;-0.00;0.00";

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
