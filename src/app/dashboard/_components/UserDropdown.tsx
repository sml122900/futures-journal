'use client';
import { useState, useRef, useEffect } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";

interface Props {
  name: string;
  email: string;
  exchange: string;
}

export default function UserDropdown({ name, email, exchange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const initial = name?.charAt(0).toUpperCase() || "?";

  const menuItem = (href: string, icon: string, label: string) => (
    <Link href={href} onClick={() => setOpen(false)}
      className="flex items-center gap-3 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors">
      <span className="text-base">{icon}</span>
      {label}
    </Link>
  );

  return (
    <div className="relative" ref={ref}>
      {/* 아바타 버튼 */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-sm font-bold text-white hover:bg-green-500 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-950"
      >
        {initial}
      </button>

      {/* 드롭다운 */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* 유저 정보 */}
          <div className="px-4 py-3 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-green-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                {initial}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{name}</p>
                <p className="text-xs text-gray-500 truncate">{email}</p>
              </div>
            </div>
            <div className="mt-2">
              <span className="text-xs text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full">
                {exchange.toUpperCase()} 연결됨
              </span>
            </div>
          </div>

          {/* 메뉴 */}
          <div className="py-1">
            {menuItem("/settings/profile", "👤", "회원정보 수정")}
            {menuItem("/onboarding/exchange", "🔑", "API 키 관리")}
            {menuItem("/settings/ai", "🤖", "AI 설정")}
            {menuItem("/settings/notifications", "🔔", "알림 설정")}
            {menuItem("/settings/emergency", "🛡️", "Emergency 설정")}
            {menuItem("/settings/export", "📥", "데이터 내보내기")}
            {menuItem("/milestones", "🏆", "마일스톤")}
            {menuItem("/coach", "💬", "AI 코치")}
          </div>

          <div className="border-t border-gray-800 py-1">
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-400 hover:bg-gray-800 hover:text-red-300 transition-colors"
            >
              <span className="text-base">↩</span>
              로그아웃
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
