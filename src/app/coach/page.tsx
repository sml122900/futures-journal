'use client';
// AI 코치 풀 페이지 채팅
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

const QUICK_QUESTIONS = [
  "내 약점이 뭐야?",
  "이번 주 어땠어?",
  "다음 거래 조언해줘",
  "FOMO 극복 방법은?",
];

export default function CoachPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [credits, setCredits] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadHistory = useCallback(async () => {
    const [histRes, creditRes] = await Promise.all([
      fetch("/api/ai/coach-chat"),
      fetch("/api/user/credits"),
    ]);
    const [hist, cred] = await Promise.all([histRes.json(), creditRes.json()]);
    if (hist.success) setMessages(hist.data);
    if (cred.success) setCredits(cred.data.credits);
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(text: string) {
    if (!text.trim() || sending) return;
    const userMsg: Message = { role: "user", content: text };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setSending(true);
    setError("");

    try {
      const res = await fetch("/api/ai/coach-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const json = await res.json();

      if (!json.success) {
        if (json.message === "INSUFFICIENT_CREDITS") {
          setError(`크레딧 부족 (보유: ${json.data.current}c / 필요: ${json.data.required}c)`);
        } else {
          setError(json.message ?? "AI 오류");
        }
        setMessages((p) => p.slice(0, -1)); // 실패 시 사용자 메시지 제거
        return;
      }

      setMessages((p) => [...p, { role: "assistant", content: json.data.reply }]);
      setCredits((c) => (c !== null ? c - 5 : c));
    } catch {
      setError("네트워크 오류");
      setMessages((p) => p.slice(0, -1));
    } finally {
      setSending(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white">
      {/* 헤더 */}
      <header className="border-b border-gray-800 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm">← 대시보드</Link>
          <div className="flex items-center gap-2">
            <span className="text-base">🤖</span>
            <h1 className="text-base font-semibold text-white">AI 코치</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {credits !== null && (
            <span className="text-xs text-gray-500">잔여 <span className="text-green-400 font-semibold">{credits}</span>c (메시지당 5c)</span>
          )}
          <button onClick={() => { setMessages([]); loadHistory(); }}
            className="text-xs text-gray-500 hover:text-gray-300 bg-gray-800 hover:bg-gray-700 px-2.5 py-1.5 rounded-lg transition-colors">
            초기화
          </button>
        </div>
      </header>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center pt-16">
            <p className="text-4xl mb-3">🤖</p>
            <p className="text-gray-300 font-medium">안녕하세요! 매매 코치 Claude입니다.</p>
            <p className="text-sm text-gray-500 mt-1">매매 패턴, 심리 관리, 전략 개선에 대해 질문해보세요.</p>
            <div className="flex flex-wrap justify-center gap-2 mt-6">
              {QUICK_QUESTIONS.map((q) => (
                <button key={q} onClick={() => send(q)}
                  className="text-sm text-gray-400 bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-1.5 rounded-full transition-colors">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center text-sm mr-2 shrink-0 mt-0.5">
                🤖
              </div>
            )}
            <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              msg.role === "user"
                ? "bg-green-600 text-white rounded-br-sm"
                : "bg-gray-800 text-gray-200 rounded-bl-sm"
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center text-sm mr-2 shrink-0">🤖</div>
            <div className="bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-2.5">
              <span className="flex gap-1">
                {[...Array(3)].map((_, i) => (
                  <span key={i} className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="text-sm text-red-400 text-center bg-red-900/20 border border-red-500/20 rounded-xl px-4 py-3">
            {error}
            {error.startsWith("크레딧") && <Link href="/payments" className="ml-2 text-green-400 underline">충전하기 →</Link>}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 빠른 질문 (메시지 있을 때) */}
      {messages.length > 0 && (
        <div className="px-6 pb-2 flex gap-2 overflow-x-auto shrink-0">
          {QUICK_QUESTIONS.map((q) => (
            <button key={q} onClick={() => send(q)} disabled={sending}
              className="text-xs text-gray-500 bg-gray-800 hover:bg-gray-700 border border-gray-800 px-3 py-1 rounded-full whitespace-nowrap transition-colors shrink-0">
              {q}
            </button>
          ))}
        </div>
      )}

      {/* 입력창 */}
      <div className="border-t border-gray-800 px-4 py-3 flex gap-3 items-end shrink-0">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="메시지를 입력하세요... (Enter: 전송, Shift+Enter: 줄바꿈)"
          rows={1}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white resize-none outline-none focus:border-green-500 transition-colors placeholder-gray-600"
          style={{ minHeight: "2.75rem", maxHeight: "8rem" }}
        />
        <button
          onClick={() => send(input)}
          disabled={sending || !input.trim()}
          className="bg-green-500 hover:bg-green-400 disabled:opacity-40 text-black font-bold px-4 py-2.5 rounded-xl transition-colors shrink-0"
        >
          →
        </button>
      </div>
    </div>
  );
}
