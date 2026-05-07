import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { EXCHANGES, EXCHANGE_SLUGS } from "@/lib/exchanges";

const EXCHANGE_ICONS: Record<string, string> = {
  binance: '🟡',
  bybit: '🟠',
  okx: '⚫',
  bitget: '🟢',
  bingx: '🔵',
};

export default async function ExchangeSelectPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-12">
      <div className="max-w-lg mx-auto">
        <Link href="/onboarding" className="text-gray-400 hover:text-white text-sm mb-8 inline-block">
          ← 뒤로
        </Link>
        <h1 className="text-2xl font-bold text-white mb-2">거래소 선택</h1>
        <p className="text-gray-400 text-sm mb-8">사용 중인 거래소를 선택하세요</p>

        <div className="space-y-3">
          {EXCHANGE_SLUGS.map((slug) => {
            const ex = EXCHANGES[slug];
            return (
              <Link
                key={slug}
                href={`/onboarding/exchange/${slug}`}
                className={`flex items-center gap-4 p-4 rounded-xl border ${ex.bgColor} hover:opacity-80 transition-opacity`}
              >
                <span className="text-2xl">{EXCHANGE_ICONS[slug]}</span>
                <div className="flex-1">
                  <p className={`font-semibold ${ex.color}`}>{ex.name}</p>
                  <p className="text-gray-500 text-xs">USDT-M 선물</p>
                </div>
                <span className="text-gray-600 text-sm">→</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
