'use client';
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ProfilePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPw) { setStatus({ msg: "현재 비밀번호를 입력해주세요", ok: false }); return; }
    setLoading(true); setStatus(null);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name || undefined, currentPassword: currentPw, newPassword: newPw || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus({ msg: "변경사항이 저장됐습니다", ok: true });
        setCurrentPw(""); setNewPw("");
      } else {
        setStatus({ msg: data.message || "저장 실패", ok: false });
      }
    } catch {
      setStatus({ msg: "서버 오류", ok: false });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-12">
      <div className="max-w-md mx-auto">
        <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm mb-8 inline-block">← 대시보드</Link>
        <h1 className="text-2xl font-bold text-white mb-8">회원정보 수정</h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">기본 정보</h2>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">이름</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="변경할 이름 (비워두면 유지)"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-green-500 transition-colors" />
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">비밀번호 변경</h2>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">현재 비밀번호 <span className="text-red-400">*</span></label>
              <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)}
                placeholder="현재 비밀번호"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-green-500 transition-colors" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">새 비밀번호</label>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                placeholder="변경할 비밀번호 (비워두면 유지)"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-green-500 transition-colors" />
            </div>
          </div>

          {status && (
            <div className={`border rounded-lg px-4 py-2.5 text-sm ${status.ok ? 'bg-green-900/30 border-green-700 text-green-300' : 'bg-red-900/30 border-red-700 text-red-300'}`}>
              {status.msg}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold py-2.5 rounded-lg transition-colors">
            {loading ? "저장 중..." : "저장"}
          </button>
        </form>
      </div>
    </div>
  );
}
