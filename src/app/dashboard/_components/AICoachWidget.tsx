'use client';
// 대시보드 우측 하단 AI 코치 플로팅 버튼
import { useState } from "react";
import AICoachChat from "./AICoachChat";

export default function AICoachWidget() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && <AICoachChat onClose={() => setOpen(false)} />}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 w-12 h-12 bg-green-500 hover:bg-green-400 text-black rounded-full shadow-2xl flex items-center justify-center text-xl transition-all z-40 hover:scale-110"
        title="AI 코치와 대화하기"
      >
        {open ? "✕" : "🤖"}
      </button>
    </>
  );
}
