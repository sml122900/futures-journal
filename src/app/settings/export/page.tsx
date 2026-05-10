'use client';
// 데이터 내보내기 설정 페이지
import { useState } from "react";
import Link from "next/link";

type Format = "csv" | "excel" | "json";
type DataType = "positions" | "orders" | "memos";

const FORMAT_INFO = {
  csv:   { label: "CSV",   icon: "📄", desc: "엑셀/스프레드시트에서 바로 열 수 있는 범용 형식", cost: "무료" },
  excel: { label: "Excel", icon: "📊", desc: "시트 구성 (포지션/메모/월별 요약), 색상 강조 포함", cost: "무료" },
  json:  { label: "JSON",  icon: "💾", desc: "메모·룰·위반·리포트 전체 백업 (복원 가능)", cost: "무료" },
};

const DATA_TYPES: { value: DataType; label: string }[] = [
  { value: "positions", label: "포지션 내역" },
  { value: "orders",    label: "주문 내역"   },
  { value: "memos",     label: "메모"         },
];

const PERIODS = [
  { label: "최근 7일",   days: 7   },
  { label: "최근 30일",  days: 30  },
  { label: "최근 90일",  days: 90  },
  { label: "전체",       days: 0   },
];

export default function ExportPage() {
  const [format, setFormat]   = useState<Format>("excel");
  const [dataType, setDataType] = useState<DataType>("positions");
  const [period, setPeriod]   = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  async function handleExport() {
    setLoading(true);
    setError("");
    try {
      const now = new Date();
      const from = period ? new Date(now.getTime() - period * 86400000).toISOString() : undefined;
      const to   = now.toISOString();

      let url: string;
      if (format === "json") {
        url = "/api/export/json";
      } else if (format === "excel") {
        url = `/api/export/excel?from=${from ?? ""}&to=${to}`;
      } else {
        url = `/api/export/csv?type=${dataType}&from=${from ?? ""}&to=${to}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError((j as { message?: string }).message ?? "다운로드 실패");
        return;
      }

      // 파일 다운로드 트리거
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const fname = cd.match(/filename="([^"]+)"/)?.[1] ?? `export.${format}`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fname;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setError("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-3 flex items-center gap-4">
        <Link href="/settings/profile" className="text-gray-400 hover:text-white text-sm">← 설정</Link>
        <h1 className="text-base font-semibold text-white">데이터 내보내기</h1>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* 형식 선택 */}
        <section>
          <h2 className="text-sm font-semibold text-gray-300 mb-3">내보내기 형식</h2>
          <div className="grid grid-cols-3 gap-3">
            {(Object.entries(FORMAT_INFO) as [Format, typeof FORMAT_INFO[Format]][]).map(([f, info]) => (
              <button key={f} onClick={() => setFormat(f)}
                className={`bg-gray-900 border rounded-xl p-4 text-left transition-colors ${
                  format === f ? "border-green-400/50 bg-green-400/5" : "border-gray-800 hover:border-gray-700"
                }`}>
                <div className="text-2xl mb-2">{info.icon}</div>
                <div className="text-sm font-semibold text-white">{info.label}</div>
                <div className="text-xs text-gray-500 mt-1 leading-relaxed">{info.desc}</div>
              </button>
            ))}
          </div>
        </section>

        {/* 데이터 종류 (CSV만) */}
        {format === "csv" && (
          <section>
            <h2 className="text-sm font-semibold text-gray-300 mb-3">데이터 종류</h2>
            <div className="flex gap-2">
              {DATA_TYPES.map(({ value, label }) => (
                <button key={value} onClick={() => setDataType(value)}
                  className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                    dataType === value
                      ? "bg-green-600 border-green-500 text-white font-medium"
                      : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600"
                  }`}>{label}</button>
              ))}
            </div>
          </section>
        )}

        {/* 기간 선택 (JSON 제외) */}
        {format !== "json" && (
          <section>
            <h2 className="text-sm font-semibold text-gray-300 mb-3">기간</h2>
            <div className="flex gap-2 flex-wrap">
              {PERIODS.map(({ label, days }) => (
                <button key={days} onClick={() => setPeriod(days)}
                  className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                    period === days
                      ? "bg-green-600 border-green-500 text-white font-medium"
                      : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600"
                  }`}>{label}</button>
              ))}
            </div>
          </section>
        )}

        {/* JSON 안내 */}
        {format === "json" && (
          <div className="bg-blue-900/20 border border-blue-400/20 rounded-xl p-4 text-sm text-blue-300">
            메모, 룰, 위반 기록, AI 리포트 전체를 JSON으로 백업합니다. 비트겟 거래 데이터는 포함되지 않습니다.
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button onClick={handleExport} disabled={loading}
          className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold py-3 rounded-xl transition-colors text-sm">
          {loading ? "생성 중..." : `${FORMAT_INFO[format].label} 다운로드`}
        </button>
      </main>
    </div>
  );
}
