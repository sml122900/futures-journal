'use client';
// 데이터 내보내기 설정 페이지
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Format  = "excel" | "csv";
type Section = "positions" | "orders" | "full";

const PERIODS = [
  { label: "7일",   days: 7   },
  { label: "30일",  days: 30  },
  { label: "90일",  days: 90  },
  { label: "전체",  days: 0   },
  { label: "직접",  days: -1  },
];

function useDateRange() {
  const [period, setPeriod] = useState(30);
  const [from, setFrom]     = useState("");
  const [to, setTo]         = useState(() => new Date().toISOString().slice(0, 10));

  function getParams(): { from?: string; to: string } {
    if (period === -1) {
      return { from: from ? new Date(from).toISOString() : undefined, to: new Date(to + "T23:59:59").toISOString() };
    }
    const now = new Date();
    return {
      from: period ? new Date(now.getTime() - period * 86400000).toISOString() : undefined,
      to:   now.toISOString(),
    };
  }

  return { period, setPeriod, from, setFrom, to, setTo, getParams };
}

function DateRangeSelector({ state }: { state: ReturnType<typeof useDateRange> }) {
  const { period, setPeriod, from, setFrom, to, setTo } = state;
  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        {PERIODS.map(({ label, days }) => (
          <button key={days} onClick={() => setPeriod(days)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              period === days
                ? "bg-green-600 border-green-500 text-white font-medium"
                : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600"
            }`}>{label}</button>
        ))}
      </div>
      {period === -1 && (
        <div className="flex items-center gap-2 mt-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-green-500" />
          <span className="text-gray-500 text-sm">~</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-green-500" />
        </div>
      )}
    </div>
  );
}

function ExportCard({
  title,
  description,
  section,
  memoNote,
}: {
  title: string;
  description: string;
  section: Section;
  memoNote?: string;
}) {
  const router = useRouter();
  const [format, setFormat] = useState<Format>("excel");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const dateRange = useDateRange();

  function handleClickSelect() {
    sessionStorage.setItem("fjExportSelect", JSON.stringify({ section }));
    router.push("/dashboard");
  }

  async function handleDownload() {
    setLoading(true);
    setError("");
    try {
      const { from, to } = dateRange.getParams();
      let url: string;

      if (section === "full") {
        if (format === "excel") {
          url = `/api/export/excel?${from ? `from=${from}&` : ""}to=${to}`;
        } else {
          url = `/api/export/json`;
        }
      } else {
        const type = section; // "positions" | "orders"
        if (format === "excel") {
          url = `/api/export/excel?type=${type}&${from ? `from=${from}&` : ""}to=${to}`;
        } else {
          url = `/api/export/csv?type=${type}&${from ? `from=${from}&` : ""}to=${to}`;
        }
      }

      const res = await fetch(url);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError((j as { message?: string }).message ?? "다운로드 실패");
        return;
      }

      const blob = await res.blob();
      const cd   = res.headers.get("Content-Disposition") ?? "";
      const fname = cd.match(/filename="([^"]+)"/)?.[1]
        ?? `export-${new Date().toISOString().slice(0, 10)}.${format === "excel" ? "xlsx" : format === "csv" ? "csv" : "json"}`;
      const a = document.createElement("a");
      a.href     = URL.createObjectURL(blob);
      a.download = fname;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setError("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }

  const isFullJson = section === "full" && format === "csv";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        {memoNote && (
          <p className="text-xs text-green-400/80 mt-1">{memoNote}</p>
        )}
      </div>

      {/* 형식 */}
      <div>
        <p className="text-xs text-gray-400 mb-2">형식</p>
        <div className="flex gap-2">
          {(section === "full"
            ? [{ v: "excel" as Format, label: "Excel (.xlsx)" }, { v: "csv" as Format, label: "JSON 백업" }]
            : [{ v: "excel" as Format, label: "Excel (.xlsx)" }, { v: "csv" as Format, label: "CSV" }]
          ).map(({ v, label }) => (
            <button key={v} onClick={() => setFormat(v)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                format === v
                  ? "bg-blue-600 border-blue-500 text-white font-medium"
                  : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600"
              }`}>{label}</button>
          ))}
        </div>
      </div>

      {/* 기간 (JSON은 기간 무관) */}
      {!isFullJson && (
        <div>
          <p className="text-xs text-gray-400 mb-2">기간</p>
          <DateRangeSelector state={dateRange} />
        </div>
      )}

      {isFullJson && (
        <p className="text-xs text-gray-500">메모·룰·위반·리포트 전체 백업 (기간 무관)</p>
      )}

      {/* 클릭으로 선택 */}
      {section !== "full" && (
        <div>
          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-gray-800" />
            <span className="text-xs text-gray-600">또는</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>
          <button onClick={handleClickSelect}
            className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 font-medium py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
            <span>🖱️</span> 클릭으로 선택
          </button>
          <p className="text-xs text-gray-600 mt-1 text-center">대시보드에서 시작·종료 항목을 더블클릭해 범위 지정</p>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button onClick={handleDownload} disabled={loading}
        className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold py-2.5 rounded-lg transition-colors text-sm">
        {loading ? "생성 중..." : "다운로드"}
      </button>
    </div>
  );
}

export default function ExportPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-3 flex items-center gap-4">
        <Link href="/settings/profile" className="text-gray-400 hover:text-white text-sm">← 설정</Link>
        <h1 className="text-base font-semibold text-white">데이터 내보내기</h1>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-4">
        <ExportCard
          section="positions"
          title="포지션 내역"
          description="종료된 포지션 전체를 Bitget 원본 형식으로 내보냅니다."
          memoNote="진입이유·청산이유·심리상태·자유메모 컬럼이 추가됩니다."
        />
        <ExportCard
          section="orders"
          title="매매 내역 (체결)"
          description="체결된 개별 주문 전체를 Bitget 원본 형식으로 내보냅니다."
        />
        <ExportCard
          section="full"
          title="전체 저널 내보내기"
          description="포지션·메모·월별 요약·세금 신고용 다중 시트 Excel 또는 JSON 전체 백업."
        />
      </main>
    </div>
  );
}
