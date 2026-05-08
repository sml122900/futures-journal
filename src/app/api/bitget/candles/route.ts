// 비트겟 OHLCV 캔들 데이터 조회 (1000봉 초과 시 자동 분할 병합)
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { bitgetRequest, getDecryptedCredentials } from "@/lib/bitget";

interface RawCandle { time: number; open: number; high: number; low: number; close: number; volume: number; }

async function fetchChunk(credentials: Parameters<typeof bitgetRequest>[0], symbol: string, tf: string, from: number, to: number): Promise<RawCandle[]> {
  const data = await bitgetRequest(credentials, "GET", "/api/v2/mix/market/candles", {
    symbol,
    productType: "USDT-FUTURES",
    granularity: tf,
    startTime: String(from),
    endTime: String(to),
    limit: "1000",
  });
  const list: string[][] = data?.data ?? [];
  return list.map(c => ({
    time: Math.floor(parseInt(c[0]) / 1000),
    open: parseFloat(c[1]),
    high: parseFloat(c[2]),
    low: parseFloat(c[3]),
    close: parseFloat(c[4]),
    volume: parseFloat(c[5]),
  }));
}

// 타임프레임 ms 단위 매핑
const TF_MS: Record<string, number> = {
  "1m": 60_000, "3m": 180_000, "5m": 300_000, "15m": 900_000,
  "30m": 1_800_000, "1H": 3_600_000, "4H": 14_400_000, "1D": 86_400_000,
};

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });

    const credentials = await getDecryptedCredentials(session.user.id);
    if (!credentials) return NextResponse.json({ success: false, message: "API 키 필요" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get("symbol") ?? "";
    const tf = searchParams.get("tf") ?? "5m";
    const from = parseInt(searchParams.get("from") ?? "0");
    const to = parseInt(searchParams.get("to") ?? String(Date.now()));

    const tfMs = TF_MS[tf] ?? 300_000;
    const maxSpan = 1000 * tfMs;

    // 1000봉 초과 구간 자동 분할
    const chunks: { s: number; e: number }[] = [];
    let cur = from;
    while (cur < to) {
      chunks.push({ s: cur, e: Math.min(cur + maxSpan, to) });
      cur += maxSpan;
    }

    const results = await Promise.all(
      chunks.map(({ s, e }) => fetchChunk(credentials, symbol, tf, s, e))
    );

    const seen = new Set<number>();
    const candles = results.flat()
      .filter(c => { if (seen.has(c.time)) return false; seen.add(c.time); return true; })
      .sort((a, b) => a.time - b.time);

    return NextResponse.json({ success: true, candles });
  } catch (err) {
    console.error("[bitget/candles]", err);
    return NextResponse.json({ success: false, message: "캔들 조회 실패" }, { status: 500 });
  }
}
