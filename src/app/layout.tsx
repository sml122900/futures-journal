import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Futures Journal",
  description: "비트겟 선물 매매 일지",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Futures Journal" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#4ade80",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head suppressHydrationWarning>
        {/* 화면 깜빡임 방지: JS 실행 전에 테마 적용 */}
        {/* 테마 초기화: JS 실행 전 깜빡임 방지 */}
        <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `
          (function(){
            var t=localStorage.getItem('fj_theme')||'dark';
            var e=t==='system'?(window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'):t;
            document.documentElement.setAttribute('data-theme',e);
          })();
        `}} />
        {/* 개발 모드: 기존 SW 해제 / 프로덕션 전용 SW 등록 */}
        {process.env.NODE_ENV !== 'production' ? (
          <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `
            if('serviceWorker' in navigator){
              navigator.serviceWorker.getRegistrations().then(function(regs){
                regs.forEach(function(r){ r.unregister(); });
              });
            }
          `}} />
        ) : (
          <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `
            if('serviceWorker' in navigator){
              window.addEventListener('load',function(){
                navigator.serviceWorker.register('/sw.js');
              });
            }
          `}} />
        )}
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
