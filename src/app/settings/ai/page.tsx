'use client';
import { useState, useEffect } from "react";
import Link from "next/link";
import { PACKAGES, CREDIT_COSTS } from "@/lib/credits";

const MODELS = [
  { id: "gemini-2.0-flash-lite", brand: "gemini", tier: "Flash-Lite", desc: "빠름 · 저비용" },
  { id: "gemini-2.0-flash",      brand: "gemini", tier: "Flash",      desc: "권장 · 균형" },
  { id: "gemini-1.5-pro",        brand: "gemini", tier: "Pro",        desc: "고품질 · 고비용" },
  { id: "claude-sonnet-4-6",     brand: "claude", tier: "Sonnet 4.6", desc: "균형 · 저비용" },
  { id: "claude-opus-4-7",       brand: "claude", tier: "Opus 4.7",   desc: "고품질 · 고비용" },
] as const;

type ModelId = typeof MODELS[number]["id"];

export default function AiSettingsPage() {
  const [defaultModel, setDefaultModel] = useState<ModelId>("gemini-2.0-flash");
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("ai_model");
    if (saved && MODELS.some(m => m.id === saved)) setDefaultModel(saved as ModelId);
    fetch("/api/user/credits").then(r => r.json()).then(d => {
      if (d.success) setCredits(d.data.credits);
    });
  }, []);

  function selectModel(id: ModelId) {
    setDefaultModel(id);
    localStorage.setItem("ai_model", id);
  }

  const geminiModels = MODELS.filter(m => m.brand === "gemini");
  const claudeModels = MODELS.filter(m => m.brand === "claude");

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-12">
      <div className="max-w-xl mx-auto space-y-8">
        <div>
          <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm inline-block mb-6">← 대시보드</Link>
          <h1 className="text-2xl font-bold text-white">AI 설정</h1>
          <p className="text-gray-500 text-sm mt-1">음성 메모 자동 분류에 사용할 기본 AI 모델을 선택합니다.</p>
        </div>

        {/* 크레딧 잔액 */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">크레딧 잔액</p>
            <p className="text-2xl font-bold text-green-400">
              {credits !== null ? credits.toLocaleString() : "—"}<span className="text-sm font-normal text-gray-500 ml-1">크레딧</span>
            </p>
          </div>
          <Link href="/payments"
            className="bg-green-500 hover:bg-green-400 text-black font-semibold text-sm px-4 py-2 rounded-lg transition-colors">
            충전하기
          </Link>
        </div>

        {/* 기본 모델 선택 */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">기본 모델</h2>
          <p className="text-xs text-gray-600">선택한 모델이 음성 메모 모달의 기본값으로 사용됩니다. 모달에서 변경도 가능합니다.</p>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-blue-400">Gemini</span>
              <span className="text-xs text-gray-600">by Google</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {geminiModels.map(m => (
                <button key={m.id} onClick={() => selectModel(m.id)}
                  className={`border rounded-lg p-3 text-left transition-colors ${defaultModel === m.id ? "border-blue-500 bg-blue-500/10" : "border-gray-700 hover:border-gray-500"}`}>
                  <div className={`text-xs font-semibold mb-0.5 ${defaultModel === m.id ? "text-blue-400" : "text-gray-300"}`}>{m.tier}</div>
                  <div className="text-xs text-gray-500">{m.desc}</div>
                  <div className="text-xs text-gray-600 mt-1">{CREDIT_COSTS[m.id]}c / 회</div>
                  {defaultModel === m.id && <div className="mt-1 text-blue-400 text-xs">✓ 기본값</div>}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-orange-400">Claude</span>
              <span className="text-xs text-gray-600">by Anthropic</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {claudeModels.map(m => (
                <button key={m.id} onClick={() => selectModel(m.id)}
                  className={`border rounded-lg p-3 text-left transition-colors ${defaultModel === m.id ? "border-orange-500 bg-orange-500/10" : "border-gray-700 hover:border-gray-500"}`}>
                  <div className={`text-xs font-semibold mb-0.5 ${defaultModel === m.id ? "text-orange-400" : "text-gray-300"}`}>{m.tier}</div>
                  <div className="text-xs text-gray-500">{m.desc}</div>
                  <div className="text-xs text-gray-600 mt-1">{CREDIT_COSTS[m.id]}c / 회</div>
                  {defaultModel === m.id && <div className="mt-1 text-orange-400 text-xs">✓ 기본값</div>}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 패키지 안내 */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">충전 패키지</h2>
          <div className="space-y-2">
            {PACKAGES.map(pkg => (
              <div key={pkg.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{pkg.name}</span>
                <span className="text-gray-400">{pkg.credits.toLocaleString()}c</span>
                <span className="text-gray-500">{pkg.priceKrw.toLocaleString()}원</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
