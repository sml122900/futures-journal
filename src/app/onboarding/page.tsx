import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="text-6xl mb-6">🔑</div>
        <h1 className="text-2xl font-bold text-white mb-3">
          거래소 API 키 연결이 필요합니다
        </h1>
        <p className="text-gray-400 text-sm leading-relaxed mb-8">
          API 키를 등록하면 거래 내역, 포지션, 잔고를<br />
          자동으로 불러올 수 있습니다.<br />
          <span className="text-green-400">읽기 전용 권한</span>만 사용하므로 안전합니다.
        </p>
        <Link
          href="/onboarding/exchange"
          className="inline-block bg-green-500 hover:bg-green-400 text-black font-semibold px-8 py-3 rounded-lg transition-colors"
        >
          거래소 선택하기 →
        </Link>
      </div>
    </div>
  );
}
