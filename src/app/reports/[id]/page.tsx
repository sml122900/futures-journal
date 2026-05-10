// 리포트 상세 페이지 (서버 컴포넌트)
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";
import UserDropdown from "@/app/dashboard/_components/UserDropdown";
import NavLinks from "@/components/NavLinks";
import SaveImageButton from "./SaveImageButton";

type RouteContext = { params: Promise<{ id: string }> };

interface ReportContent {
  summary: {
    trades: number;
    winRate: number;
    winRateChange: number | null;
    totalPnl: number;
    totalPnlPercent: number | null;
  };
  highlights: string[];
  improvements: Array<{ issue: string; suggestion: string }>;
  nextWeekGoals: string[];
  coachComment: string;
}

export default async function ReportDetailPage({ params }: RouteContext) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;

  const [report, apiKey, userRow] = await Promise.all([
    prisma.aIReport.findFirst({ where: { id, userId: session.user.id } }),
    prisma.apiKey.findFirst({ where: { userId: session.user.id }, select: { id: true, exchange: true } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { credits: true } }),
  ]);

  if (!report || !apiKey) { notFound(); return; }

  const content = report.content as unknown as ReportContent;
  const isWeekly = report.type === "weekly_report";

  function fmtDate(d: Date) {
    return new Date(d).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-bold text-green-400">Futures Journal</h1>
          <NavLinks active="stats" />
        </div>
        <div className="flex items-center gap-3">
          <Link href="/payments"
            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs text-gray-300 px-3 py-1.5 rounded-lg transition-colors">
            <span className="text-green-400 font-semibold">{(userRow?.credits ?? 0).toLocaleString()}</span>
            <span>크레딧</span>
            <span className="text-gray-500">+충전</span>
          </Link>
          <UserDropdown name={session.user?.name ?? ""} email={session.user?.email ?? ""} exchange={apiKey.exchange} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6" id="report-content">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{isWeekly ? "주간 리포트" : "월간 리포트"}</p>
            <h2 className="text-2xl font-bold text-white mt-0.5">
              {fmtDate(report.periodStart)} ~ {fmtDate(report.periodEnd)}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <SaveImageButton
              reportId={report.id}
              period={`${new Date(report.periodStart).toISOString().slice(0, 10)}`}
            />
            <Link href="/reports" className="text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors">
              ← 목록
            </Link>
          </div>
        </div>

        {/* 핵심 지표 */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "총 거래수", value: `${content.summary.trades}회`, cls: "text-white" },
            { label: "승률", value: `${content.summary.winRate}%`, cls: content.summary.winRate >= 50 ? "text-green-400" : "text-red-400" },
            { label: "순손익", value: `${content.summary.totalPnl >= 0 ? "+" : ""}${content.summary.totalPnl.toFixed(2)} U`, cls: content.summary.totalPnl >= 0 ? "text-green-400" : "text-red-400" },
          ].map((c) => (
            <div key={c.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center shadow-sm">
              <p className="text-xs text-gray-500 mb-1">{c.label}</p>
              <p className={`text-2xl font-bold tabular-nums ${c.cls}`}>{c.value}</p>
              {c.label === "승률" && content.summary.winRateChange !== null && (
                <p className={`text-xs mt-1 ${(content.summary.winRateChange ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {(content.summary.winRateChange ?? 0) >= 0 ? "+" : ""}{content.summary.winRateChange}%p
                </p>
              )}
            </div>
          ))}
        </div>

        {/* 잘한 점 */}
        {content.highlights?.length > 0 && (
          <div className="bg-green-900/20 border border-green-400/20 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-green-400 mb-3">🌟 잘한 점</h3>
            <ul className="space-y-2">
              {content.highlights.map((h, i) => (
                <li key={i} className="text-sm text-gray-300 flex gap-2">
                  <span className="text-green-400 shrink-0">•</span>{h}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 개선할 점 */}
        {content.improvements?.length > 0 && (
          <div className="bg-yellow-900/20 border border-yellow-400/20 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-yellow-400 mb-3">⚠️ 개선할 점</h3>
            <div className="space-y-3">
              {content.improvements.map((imp, i) => (
                <div key={i}>
                  <p className="text-sm text-gray-300 font-medium">{imp.issue}</p>
                  <p className="text-xs text-yellow-400/80 mt-0.5 pl-2 border-l border-yellow-400/30">→ {imp.suggestion}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 다음 주 목표 */}
        {content.nextWeekGoals?.length > 0 && (
          <div className="bg-blue-900/20 border border-blue-400/20 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-blue-400 mb-3">💡 {isWeekly ? "다음 주" : "다음 달"} 목표</h3>
            <ul className="space-y-2">
              {content.nextWeekGoals.map((g, i) => (
                <li key={i} className="text-sm text-gray-300 flex gap-2">
                  <span className="text-blue-400 shrink-0">{i + 1}.</span>{g}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 코치 한 마디 */}
        {content.coachComment && (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-green-400 to-blue-400" />
            <h3 className="text-sm font-semibold text-gray-300 mb-2 pl-3">📖 코치의 한 마디</h3>
            <p className="text-sm text-gray-400 leading-relaxed pl-3 whitespace-pre-line">{content.coachComment}</p>
          </div>
        )}

        <p className="text-xs text-gray-600 text-center">
          생성: {new Date(report.createdAt).toLocaleString("ko-KR")} · Claude Sonnet
        </p>
      </main>
    </div>
  );
}
