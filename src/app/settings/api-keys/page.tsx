'use client';
// 등록된 거래소 API 키 관리 페이지
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { EXCHANGES, EXCHANGE_SLUGS, type ExchangeSlug } from "@/lib/exchange-meta";

interface RegisteredKey {
  id: string;
  exchange: string;
  createdAt: string;
  updatedAt: string;
}

const EXCHANGE_ICONS: Record<string, string> = {
  binance: '🟡', bybit: '🟠', okx: '⚫', bitget: '🟢', bingx: '🔵',
};

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<RegisteredKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/user/api-key");
      const json = await res.json();
      if (json.success) setKeys(json.data.keys ?? []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (exchange: string) => {
    if (!confirm(`${EXCHANGES[exchange as ExchangeSlug]?.name ?? exchange} API 키를 삭제할까요?`)) return;
    setDeleting(exchange);
    try {
      const res = await fetch("/api/user/api-key", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exchange }),
      });
      const json = await res.json();
      if (json.success) {
        setStatus({ msg: "삭제됐습니다", ok: true });
        setKeys(prev => prev.filter(k => k.exchange !== exchange));
        setTimeout(() => setStatus(null), 2000);
      } else {
        setStatus({ msg: json.message || "삭제 실패", ok: false });
      }
    } catch {
      setStatus({ msg: "서버 오류", ok: false });
    } finally {
      setDeleting(null);
    }
  };

  const registeredSet = new Set(keys.map(k => k.exchange));

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-12">
      <div className="max-w-lg mx-auto">
        <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm mb-8 inline-block">
          ← 대시보드
        </Link>
        <h1 className="text-2xl font-bold text-white mb-1">API 키 관리</h1>
        <p className="text-gray-400 text-sm mb-8">거래소별 API 키를 등록·수정·삭제합니다</p>

        {status && (
          <div className={`border rounded-lg px-4 py-2 text-sm mb-6 ${status.ok ? 'bg-green-900/30 border-green-700 text-green-300' : 'bg-red-900/30 border-red-700 text-red-300'}`}>
            {status.msg}
          </div>
        )}

        {loading ? (
          <div className="text-gray-500 text-sm text-center py-8">불러오는 중...</div>
        ) : (
          <div className="space-y-3">
            {EXCHANGE_SLUGS.map((slug) => {
              const ex = EXCHANGES[slug];
              const registered = registeredSet.has(slug);
              const keyInfo = keys.find(k => k.exchange === slug);

              return (
                <div key={slug} className={`flex items-center gap-4 p-4 rounded-xl border ${ex.bgColor}`}>
                  <span className="text-2xl">{EXCHANGE_ICONS[slug]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-semibold ${ex.color}`}>{ex.name}</p>
                      {registered && (
                        <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full">
                          연결됨
                        </span>
                      )}
                    </div>
                    {keyInfo && (
                      <p className="text-gray-500 text-xs mt-0.5">
                        {new Date(keyInfo.updatedAt).toLocaleDateString('ko-KR')} 등록
                      </p>
                    )}
                    {!registered && (
                      <p className="text-gray-600 text-xs mt-0.5">미등록</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/onboarding/exchange/${slug}`}
                      className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
                    >
                      {registered ? "수정" : "등록"}
                    </Link>
                    {registered && (
                      <button
                        onClick={() => handleDelete(slug)}
                        disabled={deleting === slug}
                        className="text-xs px-3 py-1.5 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-700/30 transition-colors disabled:opacity-50"
                      >
                        {deleting === slug ? "..." : "삭제"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 p-4 bg-gray-900 border border-gray-800 rounded-xl text-xs text-gray-500 space-y-1">
          <p className="font-medium text-gray-400">보안 안내</p>
          <p>API 키는 AES-256-GCM으로 암호화되어 저장됩니다.</p>
          <p>읽기 전용 권한만 허용된 API 키를 사용하세요.</p>
          <p>출금·거래 권한이 있는 키는 등록하지 마세요.</p>
        </div>
      </div>
    </div>
  );
}
