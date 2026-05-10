'use client';
// 가격 정책 페이지
import { useState, useEffect } from "react";
import Link from "next/link";
import { PLAN_INFO, type Plan } from "@/lib/plans";

export default function PricingPage() {
  const [currentPlan, setCurrentPlan] = useState<Plan>("free");

  useEffect(() => {
    fetch("/api/subscriptions/current")
      .then((r) => r.json())
      .then((j) => { if (j.success) setCurrentPlan(j.data.plan); })
      .catch(() => {});
  }, []);

  const plans: Plan[] = ["free", "pro", "premium", "team"];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-3 flex items-center gap-4">
        <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm">← 대시보드</Link>
        <h1 className="text-base font-semibold text-white">요금제</h1>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-3">나에게 맞는 플랜 선택</h2>
          <p className="text-gray-400">모든 플랜은 크레딧 기반 AI 기능을 포함합니다.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => {
            const info = PLAN_INFO[plan];
            const isCurrent = plan === currentPlan;
            return (
              <div key={plan}
                className={`relative bg-gray-900 border rounded-2xl p-6 flex flex-col ${
                  info.highlight
                    ? "border-green-400/50 ring-1 ring-green-400/20"
                    : "border-gray-800"
                }`}>
                {info.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-black text-xs font-bold px-3 py-1 rounded-full">
                    추천
                  </span>
                )}
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-white">{info.label}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{info.description}</p>
                </div>
                <div className="mb-5">
                  {info.priceKrw === 0 ? (
                    <span className="text-3xl font-bold text-white">무료</span>
                  ) : (
                    <>
                      <span className="text-3xl font-bold text-white">{info.priceKrw.toLocaleString()}</span>
                      <span className="text-gray-500 text-sm ml-1">원/월</span>
                    </>
                  )}
                </div>
                <ul className="space-y-2 flex-1 mb-6">
                  {info.features.map((f) => (
                    <li key={f} className="text-sm text-gray-300 flex items-start gap-2">
                      <span className="text-green-400 shrink-0 mt-0.5">✓</span>{f}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <div className="text-center text-sm text-green-400 font-medium py-2 border border-green-400/30 rounded-xl">
                    현재 플랜
                  </div>
                ) : plan === "free" ? (
                  <div className="text-center text-sm text-gray-600 py-2">다운그레이드 불가</div>
                ) : (
                  <button className="bg-green-500 hover:bg-green-400 text-black font-semibold text-sm py-2.5 rounded-xl transition-colors">
                    업그레이드 (준비중)
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-10 text-center">
          <p className="text-sm text-gray-500">
            크레딧 기반 AI 기능은 플랜과 별도로{" "}
            <Link href="/payments" className="text-green-400 hover:text-green-300 underline">충전</Link>
            해서 사용할 수 있습니다.
          </p>
        </div>
      </main>
    </div>
  );
}
