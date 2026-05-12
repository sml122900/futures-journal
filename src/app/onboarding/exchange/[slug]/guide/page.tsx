import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { EXCHANGES, isValidExchange } from "@/lib/exchange-meta";

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { slug } = await params;
  if (!isValidExchange(slug)) notFound();

  const exchange = EXCHANGES[slug];

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-12">
      <div className="max-w-md mx-auto">
        <Link
          href={`/onboarding/exchange/${slug}`}
          className="text-gray-400 hover:text-white text-sm mb-8 inline-block"
        >
          ← API 입력 화면으로
        </Link>

        <h1 className="text-2xl font-bold text-white mb-1">
          <span className={exchange.color}>{exchange.name}</span> API 키 등록법
        </h1>
        <p className="text-gray-400 text-sm mb-8">아래 순서대로 진행하세요</p>

        <ol className="space-y-4 mb-8">
          {exchange.guideSteps.map((step, i) => (
            <li key={i} className="flex gap-4">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-green-500/20 text-green-400 text-sm font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <p className="text-gray-300 text-sm leading-relaxed pt-0.5">{step}</p>
            </li>
          ))}
        </ol>

        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
          <p className="text-red-400 text-sm font-semibold mb-1">⚠️ 보안 주의사항</p>
          <ul className="text-red-300/80 text-xs space-y-1">
            <li>• 출금 권한은 절대 부여하지 마세요</li>
            <li>• 거래(주문) 권한도 불필요합니다</li>
            <li>• 읽기 전용 권한만으로 충분합니다</li>
            <li>• API 키는 절대 타인과 공유하지 마세요</li>
          </ul>
        </div>

        <Link
          href={`/onboarding/exchange/${slug}`}
          className="block w-full text-center bg-green-500 hover:bg-green-400 text-black font-semibold py-2.5 rounded-lg transition-colors"
        >
          API 키 입력하러 가기 →
        </Link>
      </div>
    </div>
  );
}
