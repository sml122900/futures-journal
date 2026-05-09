'use client';
import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function SuccessContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<'processing' | 'done' | 'error'>('processing');
  const [credits, setCredits] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const paymentKey = params.get("paymentKey");
    const orderId = params.get("orderId");
    const amount = Number(params.get("amount"));

    if (!paymentKey || !orderId || !amount) {
      setErrorMsg("결제 정보가 누락됐습니다.");
      setState('error');
      return;
    }

    fetch("/api/payments/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    }).then(r => r.json()).then(data => {
      if (data.success) {
        setCredits(data.data.credits);
        setState('done');
      } else {
        setErrorMsg(data.message || "결제 승인 실패");
        setState('error');
      }
    }).catch(() => {
      setErrorMsg("네트워크 오류");
      setState('error');
    });
  }, [params]);

  if (state === 'processing') {
    return (
      <div className="text-center space-y-3">
        <div className="text-4xl">⏳</div>
        <p className="text-white font-semibold">결제 확인 중...</p>
        <p className="text-gray-500 text-sm">잠시만 기다려주세요.</p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="text-center space-y-4">
        <div className="text-4xl">❌</div>
        <p className="text-white font-semibold">결제 처리 실패</p>
        <p className="text-red-400 text-sm">{errorMsg}</p>
        <Link href="/payments" className="inline-block bg-gray-800 text-gray-300 px-6 py-2 rounded-lg text-sm hover:bg-gray-700 transition-colors">
          다시 시도
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center space-y-4">
      <div className="text-5xl">🎉</div>
      <p className="text-white text-xl font-bold">충전 완료!</p>
      <p className="text-green-400 text-lg font-semibold">+{credits.toLocaleString()} 크레딧</p>
      <p className="text-gray-500 text-sm">음성 메모에서 바로 사용할 수 있습니다.</p>
      <button onClick={() => router.push("/dashboard")}
        className="mt-2 bg-green-500 hover:bg-green-400 text-black font-bold px-8 py-2.5 rounded-xl transition-colors">
        대시보드로 이동
      </button>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 w-full max-w-sm">
        <Suspense fallback={<p className="text-gray-400 text-center">로딩 중...</p>}>
          <SuccessContent />
        </Suspense>
      </div>
    </div>
  );
}
