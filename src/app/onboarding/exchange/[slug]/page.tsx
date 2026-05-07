'use client';
import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { EXCHANGES, isValidExchange } from "@/lib/exchanges";
import { notFound } from "next/navigation";

export default function ApiKeyInputPage() {
  const params = useParams();
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const slug = params.slug as string;
  if (!isValidExchange(slug)) notFound();

  const exchange = EXCHANGES[slug];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/user/api-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exchange: slug, apiKey, apiSecret, passphrase }),
    });
    const data = await res.json();

    if (!data.success) {
      setError(data.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-12">
      <div className="max-w-md mx-auto">
        <Link href="/onboarding/exchange" className="text-gray-400 hover:text-white text-sm mb-8 inline-block">
          ← 거래소 선택
        </Link>

        <h1 className="text-2xl font-bold text-white mb-1">
          <span className={exchange.color}>{exchange.name}</span> API 키 등록
        </h1>
        <p className="text-gray-400 text-sm mb-8">읽기 전용 권한의 API 키를 입력하세요</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">API Key</label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required
              placeholder="API Key를 입력하세요"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-colors font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Secret Key</label>
            <input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              required
              placeholder="Secret Key를 입력하세요"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-colors font-mono text-sm"
            />
          </div>
          {exchange.hasPassphrase && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Passphrase</label>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                required
                placeholder="Passphrase를 입력하세요"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-colors font-mono text-sm"
              />
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="pt-2 space-y-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold py-2.5 rounded-lg transition-colors"
            >
              {loading ? "등록 중..." : "API 키 등록하기"}
            </button>
            <Link
              href={`/onboarding/exchange/${slug}/guide`}
              className="block w-full text-center bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-2.5 rounded-lg transition-colors text-sm"
            >
              📖 API 등록하는 법
            </Link>
          </div>
        </form>

        <p className="text-gray-600 text-xs mt-6 text-center">
          API 키는 AES-256-GCM으로 암호화되어 저장됩니다
        </p>
      </div>
    </div>
  );
}
