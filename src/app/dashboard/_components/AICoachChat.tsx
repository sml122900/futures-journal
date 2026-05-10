'use client';
// 대시보드 인라인 AI 코치 채팅 모달
import { useState, useRef, useEffect } from "react";
import Link from "next/link";

interface Message { role: "user" | "assistant"; content: string; }

const QUICK = ["내 약점이 뭐야?", "이번 주 어땠어?", "다음 거래 조언해줘"];

interface Props {
  onClose: () => void;
}

export default function AICoachChat({ onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [sending, setSending]   = useState(false);
  const [error, setError]       = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(text: string) {
    if (!text.trim() || sending) return;
    setMessages((p) => [...p, { role: "user", content: text }, { role: "assistant", content: "" }]);
    setInput("");
    setSending(true);
    setError("");

    try {
      const res = await fetch("/api/ai/coach-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationId: "widget" }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { message?: string; data?: { current?: number; required?: number } };
        if (j.message === "INSUFFICIENT_CREDITS") {
          setError(`크레딧 부족 (${j.data?.current ?? 0}c / 필요 ${j.data?.required ?? 0}c)`);
        } else {
          setError(j.message ?? "AI 오류");
        }
        setMessages((p) => p.slice(0, -2));
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));
          if (data.error) { setError(data.error); setMessages((p) => p.slice(0, -1)); break; }
          if (data.done) break;
          if (data.text) {
            accumulated += data.text;
            setMessages((p) => {
              const next = [...p];
              next[next.length - 1] = { role: "assistant", content: accumulated };
              return next;
            });
          }
        }
      }
    } catch {
      setError("네트워크 오류");
      setMessages((p) => p.slice(0, -2));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-20 right-6 w-80 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
      style={{ maxHeight: "480px" }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2">
          <span>🤖</span>
          <span className="text-sm font-semibold text-white">AI 코치</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/coach" onClick={onClose} className="text-[10px] text-gray-500 hover:text-gray-300">전체화면</Link>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
        </div>
      </div>

      {/* 메시지 */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 text-center">빠른 질문으로 시작해보세요</p>
            {QUICK.map((q) => (
              <button key={q} onClick={() => send(q)}
                className="block w-full text-left text-xs text-gray-400 bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg transition-colors">
                {q}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
              m.role === "user" ? "bg-green-600 text-white" : "bg-gray-800 text-gray-200"
            }`}>
              {m.content || (
                <span className="flex gap-1">
                  {[...Array(3)].map((_, j) => (
                    <span key={j} className="w-1 h-1 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: `${j * 0.15}s` }} />
                  ))}
                </span>
              )}
            </div>
          </div>
        ))}
        {error && <p className="text-xs text-red-400 text-center">{error}</p>}
        <div ref={bottomRef} />
      </div>

      {/* 입력 */}
      <div className="flex gap-2 px-3 py-2 border-t border-gray-800 shrink-0">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(input); } }}
          placeholder="메시지 입력..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-green-500 transition-colors placeholder-gray-600"
        />
        <button onClick={() => send(input)} disabled={sending || !input.trim()}
          className="bg-green-500 hover:bg-green-400 disabled:opacity-40 text-black font-bold px-3 py-1.5 rounded-lg transition-colors text-xs">
          →
        </button>
      </div>
    </div>
  );
}
