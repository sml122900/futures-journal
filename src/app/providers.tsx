'use client';
import { SessionProvider } from "next-auth/react";
import ThemeProvider from "@/lib/theme";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
      <ThemeProvider>{children}</ThemeProvider>
    </SessionProvider>
  );
}
