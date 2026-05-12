'use client';
// 대시보드 상단 거래소 선택 드롭다운
import { useState, useRef, useEffect } from "react";
import { EXCHANGES, type ExchangeSlug } from "@/lib/exchange-meta";

const EXCHANGE_ICONS: Record<string, string> = {
  binance: '🟡', bybit: '🟠', okx: '⚫', bitget: '🟢', bingx: '🔵',
};

interface Props {
  registeredExchanges: string[];
  activeExchange: string;
  onChange: (exchange: string) => void;
}

export default function ExchangeSelector({ registeredExchanges, activeExchange, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  // 1개만 등록된 경우 드롭다운 불필요
  if (registeredExchanges.length <= 1) return null;

  const active = EXCHANGES[activeExchange as ExchangeSlug];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 hover:border-gray-600 transition-colors text-sm"
      >
        <span>{EXCHANGE_ICONS[activeExchange] ?? '🔗'}</span>
        <span className={active?.color ?? 'text-white'}>{active?.name ?? activeExchange}</span>
        <svg className={`w-3 h-3 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-40 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {registeredExchanges.map((slug) => {
            const ex = EXCHANGES[slug as ExchangeSlug];
            return (
              <button
                key={slug}
                onClick={() => { onChange(slug); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-800 transition-colors ${
                  slug === activeExchange ? 'text-white bg-gray-800' : 'text-gray-300'
                }`}
              >
                <span>{EXCHANGE_ICONS[slug] ?? '🔗'}</span>
                <span className={ex?.color ?? 'text-white'}>{ex?.name ?? slug}</span>
                {slug === activeExchange && <span className="ml-auto text-green-500 text-xs">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
