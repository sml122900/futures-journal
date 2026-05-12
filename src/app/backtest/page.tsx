// 백테스트 메인 페이지 — 세션 목록 + 새 세션 시작
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import BacktestMain from "./_components/BacktestMain";

export default async function BacktestPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return <BacktestMain />;
}
