// 백테스트 플레이어 페이지
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import BacktestPlayer from "./_components/BacktestPlayer";

export default async function BacktestPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  return <BacktestPlayer sessionId={id} />;
}
