import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";
import DashboardContent from "./_components/DashboardContent";
import UserDropdown from "./_components/UserDropdown";
import NavLinks from "@/components/NavLinks";
import RiskMonitor from "./_components/RiskMonitor";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [apiKey, userRow] = await Promise.all([
    prisma.apiKey.findFirst({ where: { userId: session.user.id }, select: { id: true, exchange: true } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { credits: true } }),
  ]);
  if (!apiKey) redirect("/onboarding");

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-bold text-green-400">Futures Journal</h1>
          <NavLinks active="dashboard" />
        </div>
        <div className="flex items-center gap-3">
          <a href="/payments"
            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs text-gray-300 px-3 py-1.5 rounded-lg transition-colors">
            <span className="text-green-400 font-semibold">{(userRow?.credits ?? 0).toLocaleString()}</span>
            <span>크레딧</span>
            <span className="text-gray-500">+충전</span>
          </a>
          <UserDropdown
            name={session.user?.name ?? ""}
            email={session.user?.email ?? ""}
            exchange={apiKey.exchange}
          />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-4">
        <RiskMonitor />
        <DashboardContent />
      </main>
    </div>
  );
}
