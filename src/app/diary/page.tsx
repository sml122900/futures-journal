// 심리 일기 메인 페이지 (서버 컴포넌트)
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import DiaryContent from "./_components/DiaryContent";

export default async function DiaryPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return <DiaryContent />;
}
