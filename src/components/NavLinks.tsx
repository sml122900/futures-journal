'use client';
// 공통 상단 내비게이션 링크 (대시보드 / 통계 / 룰 드롭다운)
import { useState, useRef, useEffect } from "react";
import Link from "next/link";

interface Props {
  active: "dashboard" | "stats" | "rules" | "diary" | "backtest";
}

export default function NavLinks({ active }: Props) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setRulesOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const linkCls = (page: typeof active) =>
    `px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
      active === page
        ? "text-white bg-gray-800"
        : "text-gray-400 hover:text-white hover:bg-gray-800"
    }`;

  return (
    <nav className="flex items-center gap-1">
      <Link href="/dashboard" className={linkCls("dashboard")}>대시보드</Link>
      <Link href="/stats" className={linkCls("stats")}>통계</Link>
      <Link href="/diary" className={linkCls("diary")}>일기</Link>
      <Link href="/backtest" className={linkCls("backtest")}>백테스트</Link>

      {/* 룰 드롭다운 */}
      <div className="relative" ref={ref}>
        <button
          onClick={() => setRulesOpen((v) => !v)}
          className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
            active === "rules"
              ? "text-white bg-gray-800"
              : "text-gray-400 hover:text-white hover:bg-gray-800"
          }`}
        >
          룰
          <svg className={`w-3 h-3 transition-transform ${rulesOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {rulesOpen && (
          <div className="absolute left-0 top-full mt-1 w-36 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
            <Link href="/rules" onClick={() => setRulesOpen(false)}
              className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors">
              룰 관리
            </Link>
            <Link href="/rules/violations" onClick={() => setRulesOpen(false)}
              className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors">
              위반 내역
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
