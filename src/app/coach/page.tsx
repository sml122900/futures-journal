'use client';
// AI 코치 풀페이지 채팅 (스트리밍, conversationId, 사이드바)
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

interface Message { role: "user" | "assistant"; content: string; }
interface ConvSummary { conversationId: string; content: string; createdAt: string; role: string; }

const QUICK_QUESTIONS = [
  "내 약점이 뭐야?",
  "이번 주 어땠어?",
  "다음 거래 조언해줘",
  "FOMO 극복 방법은?",
];

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export default function CoachPage() {
  const [messages, setMessages]         = useState<Message[]>([]);
  const [input, setInput]               = useState("");
  const [sending, setSending]           = useState(false);
  const [error, setError]               = useState("");
  const [credits, setCredits]           = useState<number | null>(null);
  const [conversations, setConversations] = useState<ConvSummary[]>([]);
  const [conversationId, setConversationId] = useState("default");
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/ai/coach-conversations");
    const json = await res.json();
    if (json.success) setConversations(json.data);
  }, []);

  const loadHistory = useCallback(async (convId: string) => {
    const [histRes, creditRes] = await Promise.all([
      fetch(`/api/ai/coach-chat?conversationId=${convId}`),
      fetch("/api/user/credits"),
    ]);
    const [hist, cred] = await Promise.all([histRes.json(), creditRes.json()]);
    if (hist.success) setMessages(hist.data.map((m: { role: string; content: string }) => ({ role: m.role as "user" | "assistant", content: m.content })));
    if (cred.success) setCredits(cred.data.credits);
  }, []);

  useEffect(() => {
    loadHistory(conversationId);
    loadConversations();
  }, [conversationId, loadHistory, loadConversations]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function startNewConversation() {
    const res = await fetch("/api/ai/coach-conversations", { method: "POST" });
    const json = await res.json();
    if (json.success) {
      setConversationId(json.data.conversationId);
      setMessages([]);
      setSidebarOpen(false);
    }
  }

  async function send(text: string) {
    if (!text.trim() || sending) return;
    setMessages((p) => [...p, { role: "user", content: text }]);
    setInput("");
    setSending(true);
    setError("");

    // AI 메시지 플레이스홀더
    setMessages((p) => [...p, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/ai/coach-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationId }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const j = json as { message?: string; data?: { current?: number; required?: number } };
        if (j.message === "INSUFFICIENT_CREDITS") {
          setError(`크레딧 부족 (보유: ${j.data?.current ?? 0}c / 필요: ${j.data?.required ?? 0}c)`);
        } else {
          setError(j.message ?? "AI 오류");
        }
        setMessages((p) => p.slice(0, -2)); // 사용자 + 빈 AI 메시지 제거
        return;
      }

      // SSE 스트리밍 읽기
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

          if (data.error) {
            setError(data.error);
            setMessages((p) => p.slice(0, -1));
            break;
          }
          if (data.done) {
            setCredits((c) => (c !== null ? c - 5 : c));
            loadConversations();
            break;
          }
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

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  }

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      {/* 사이드바 */}
      <aside className={`${sidebarOpen ? "w-64" : "w-0"} shrink-0 overflow-hidden transition-all duration-200 border-r border-gray-800 flex flex-col bg-gray-900`}>
        <div className="p-3 border-b border-gray-800 flex items-center justify-between shrink-0">
          <span className="text-sm font-semibold text-white">대화 목록</span>
          <button onClick={startNewConversation}
            className="text-xs text-green-400 hover:text-green-300 bg-green-400/10 px-2 py-1 rounded-lg transition-colors">
            + 새 대화
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {conversations.map((c) => (
            <button
              key={c.conversationId}
              onClick={() => { setConversationId(c.conversationId); setSidebarOpen(false); }}
              className={`w-full text-left px-3 py-2.5 border-b border-gray-800/50 hover:bg-gray-800 transition-colors ${conversationId === c.conversationId ? "bg-gray-800" : ""}`}
            >
              <p className="text-xs text-gray-300 line-clamp-2">{c.content}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">{fmtDate(c.createdAt)}</p>
            </button>
          ))}
        </div>
      </aside>

      {/* 메인 채팅 영역 */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* 헤더 */}
        <header className="border-b border-gray-800 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen((v) => !v)}
              className="text-gray-500 hover:text-white p-1 rounded hover:bg-gray-800 transition-colors">
              ☰
            </button>
            <div className="flex items-center gap-2">
              <span className="text-base">🤖</span>
              <h1 className="text-base font-semibold text-white">AI 코치</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {credits !== null && (
              <span className="text-xs text-gray-500">잔여 <span className="text-green-400 font-semibold">{credits}</span>c</span>
            )}
            <button onClick={startNewConversation}
              className="text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-2.5 py-1.5 rounded-lg transition-colors">
              새 대화
            </button>
            <Link href="/dashboard" className="text-xs text-gray-500 hover:text-gray-300">← 대시보드</Link>
          </div>
        </header>

        {/* 메시지 목록 */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
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
                <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center text-sm mr-2 shrink-0 mt-0.5">🤖</div>
              )}
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-green-600 text-white rounded-br-sm"
                  : "bg-gray-800 text-gray-200 rounded-bl-sm"
              }`}>
                {msg.content || (
                  <span className="flex gap-1">
                    {[...Array(3)].map((_, j) => (
                      <span key={j} className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: `${j * 0.15}s` }} />
                    ))}
                  </span>
                )}
              </div>
            </div>
          ))}

          {error && (
            <div className="text-sm text-red-400 text-center bg-red-900/20 border border-red-500/20 rounded-xl px-4 py-3">
              {error}
              {error.startsWith("크레딧") && <Link href="/payments" className="ml-2 text-green-400 underline">충전하기 →</Link>}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* 빠른 질문 칩 */}
        {messages.length > 0 && (
          <div className="px-4 pb-2 flex gap-2 overflow-x-auto shrink-0">
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
            placeholder="메시지 입력... (Enter: 전송, Shift+Enter: 줄바꿈)"
            rows={1}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white resize-none outline-none focus:border-green-500 transition-colors placeholder-gray-600"
            style={{ minHeight: "2.75rem", maxHeight: "8rem" }}
          />
          <button onClick={() => send(input)} disabled={sending || !input.trim()}
            className="bg-green-500 hover:bg-green-400 disabled:opacity-40 text-black font-bold px-4 py-2.5 rounded-xl transition-colors shrink-0">
            →
          </button>
        </div>
      </div>
    </div>
  );
}
