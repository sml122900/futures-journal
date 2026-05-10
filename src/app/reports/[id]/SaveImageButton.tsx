'use client';
// 리포트 이미지 저장 버튼 (html2canvas)
import { useState } from "react";

interface Props {
  reportId: string;
  period: string;
}

export default function SaveImageButton({ reportId, period }: Props) {
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const el = document.getElementById("report-content");
      if (!el) return;

      const canvas = await html2canvas(el, {
        backgroundColor: "#030712",
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `report-${period}.png`;
      a.click();
    } catch (e) {
      console.error("이미지 저장 실패:", e);
      alert("이미지 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      onClick={handleSave}
      disabled={saving}
      className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 disabled:opacity-40 px-3 py-1.5 rounded-lg transition-colors"
    >
      {saving ? (
        <span className="animate-spin">⏳</span>
      ) : (
        <span>📷</span>
      )}
      {saving ? "저장 중..." : "이미지 저장"}
    </button>
  );
}
