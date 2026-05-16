"use client";
// 대시보드 상단 휴식 선언 토글 위젯
import { useState, useEffect, useCallback } from "react";

interface RestDeclaration {
  id: string;
  expiresAt: string;
  reason?: string;
}

function formatRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "만료됨";
  const h = Math.floor(diff / 3600_000);
  const m = Math.floor((diff % 3600_000) / 60_000);
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

export function RestModeToggle() {
  const [active, setActive]       = useState<RestDeclaration | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [hours, setHours]         = useState(3);
  const [reason, setReason]       = useState("");
  const [loading, setLoading]     = useState(false);
  const [remaining, setRemaining] = useState("");

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/rest-declaration");
      const data = await res.json();
      setActive(data.active ?? null);
    } catch { /* 조회 실패 무시 */ }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // 남은 시간 1분 갱신
  useEffect(() => {
    if (!active) return;
    setRemaining(formatRemaining(active.expiresAt));
    const id = setInterval(() => {
      const diff = new Date(active.expiresAt).getTime() - Date.now();
      if (diff <= 0) { setActive(null); clearInterval(id); return; }
      setRemaining(formatRemaining(active.expiresAt));
    }, 60_000);
    return () => clearInterval(id);
  }, [active]);

  async function handleDeclare() {
    setLoading(true);
    try {
      const res = await fetch("/api/rest-declaration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours, reason: reason || undefined }),
      });
      const data = await res.json();
      if (data.declaration) {
        setActive(data.declaration);
        setShowModal(false);
        setReason("");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    setLoading(true);
    try {
      await fetch("/api/rest-declaration", { method: "DELETE" });
      setActive(null);
    } finally {
      setLoading(false);
    }
  }

  if (active) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 border-2 border-red-400 dark:border-red-500 text-sm">
        <span>😴</span>
        <span className="text-red-700 dark:text-red-300 font-semibold">
          휴식 중 — {remaining || formatRemaining(active.expiresAt)} 남음
        </span>
        <button
          onClick={handleCancel}
          disabled={loading}
          className="ml-2 text-xs text-red-500 dark:text-red-400 underline hover:no-underline"
        >
          해제
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition"
      >
        <span>😴</span>
        <span>오늘 휴식 선언</span>
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold mb-1">오늘 휴식 선언</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              이 시간 동안 매매하면 강력한 경고가 발송됩니다.
            </p>

            <p className="text-sm font-medium mb-2">휴식 시간 선택</p>
            <div className="grid grid-cols-5 gap-2 mb-4">
              {[1, 3, 6, 12, 24].map((h) => (
                <button
                  key={h}
                  onClick={() => setHours(h)}
                  className={`py-1.5 rounded-lg text-sm font-medium border transition ${
                    hours === h
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  {h}h
                </button>
              ))}
            </div>

            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="사유 입력 (선택)"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div className="flex gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                취소
              </button>
              <button
                onClick={handleDeclare}
                disabled={loading}
                className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50"
              >
                {loading ? "처리 중..." : "선언하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
