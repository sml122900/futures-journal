'use client';
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PACKAGES, type Package } from "@/lib/credits";

export default function PaymentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selected, setSelected] = useState<Package>(PACKAGES[1]);
  const [credits, setCredits] = useState<number | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    fetch("/api/user/credits").then(r => r.json()).then(d => {
      if (d.success) setCredits(d.data.credits);
    });
  }, []);

  async function handlePayment() {
    if (!session?.user || paying) return;
    setPaying(true);
    try {
      const { loadTossPayments } = await import("@tosspayments/payment-sdk");
      const tossPayments = await loadTossPayments(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!);
      const orderId = `${selected.id}_${session.user.id}_${Date.now()}`;
      await tossPayments.requestPayment("카드", {
        amount: selected.priceKrw,
        orderId,
        orderName: `Futures Journal ${selected.name} (${selected.credits.toLocaleString()} 크레딧)`,
        customerName: session.user.name ?? undefined,
        customerEmail: session.user.email ?? undefined,
        successUrl: `${window.location.origin}/payments/success`,
        failUrl: `${window.location.origin}/payments/fail`,
      });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e?.code !== "USER_CANCEL") {
        alert(`결제 오류: ${e?.message ?? e?.code ?? "알 수 없는 오류"}`);
      }
      setPaying(false);
    }
  }

  if (status === "loading") return null;
  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-12">
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm inline-block mb-6">← 대시보드</Link>
          <h1 className="text-2xl font-bold text-white">크레딧 충전</h1>
          {credits !== null && (
            <p className="text-gray-500 text-sm mt-1">현재 잔액: <span className="text-green-400 font-semibold">{credits.toLocaleString()} 크레딧</span></p>
          )}
        </div>

        {/* 패키지 선택 */}
        <div className="grid grid-cols-2 gap-3">
          {PACKAGES.map(pkg => (
            <button key={pkg.id} onClick={() => setSelected(pkg)}
              className={`border rounded-xl p-4 text-left transition-all ${selected.id === pkg.id ? "border-green-500 bg-green-500/10" : "border-gray-700 hover:border-gray-500"}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-semibold ${selected.id === pkg.id ? "text-green-400" : "text-white"}`}>{pkg.name}</span>
                {pkg.id === "basic" && <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">추천</span>}
              </div>
              <div className="text-xl font-bold text-white">{pkg.credits.toLocaleString()}<span className="text-sm font-normal text-gray-400 ml-1">크레딧</span></div>
              <div className="text-sm text-gray-400 mt-1">{pkg.priceKrw.toLocaleString()}원</div>
              <div className="text-xs text-gray-600 mt-0.5">Gemini Flash 기준 {Math.floor(pkg.credits / 10)}회</div>
            </button>
          ))}
        </div>

        {/* 크레딧 차감 안내 */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">모델별 크레딧 차감</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
            {[
              ["Gemini Flash-Lite", "5"],
              ["Gemini Flash", "10"],
              ["Gemini Pro", "30"],
              ["Claude Sonnet", "15"],
              ["Claude Opus", "50"],
            ].map(([name, cost]) => (
              <div key={name} className="flex justify-between">
                <span className="text-gray-400">{name}</span>
                <span className="text-gray-300">{cost}c</span>
              </div>
            ))}
          </div>
        </div>

        <button onClick={handlePayment} disabled={paying}
          className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl transition-colors text-base">
          {paying ? "결제창 열기 중..." : `${selected.priceKrw.toLocaleString()}원 결제하기`}
        </button>

        <p className="text-xs text-gray-600 text-center">카드 결제 · Toss Payments 보안 결제</p>
      </div>
    </div>
  );
}
