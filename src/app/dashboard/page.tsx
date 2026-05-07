import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import DashboardContent from "./_components/DashboardContent";
import UserDropdown from "./_components/UserDropdown";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const apiKey = await prisma.apiKey.findFirst({
    where: { userId: session.user.id },
    select: { id: true, exchange: true },
  });
  if (!apiKey) redirect("/onboarding");

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-green-400">Futures Journal</h1>
        <UserDropdown
          name={session.user?.name ?? ""}
          email={session.user?.email ?? ""}
          exchange={apiKey.exchange}
        />
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        <DashboardContent />
      </main>
    </div>
  );
}
