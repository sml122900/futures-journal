'use client';
// 플랜 업그레이드 필요 시 표시하는 모달
import { useRouter } from "next/navigation";

interface Props {
  required: "pro" | "premium" | "team";
  feature?: string;
  onClose: () => void;
}

const PLAN_LABELS: Record<string, string> = {
  pro:     "Pro",
  premium: "Premium",
  team:    "Team",
};

const PLAN_PRICES: Record<string, string> = {
  pro:     "9,900원/월",
  premium: "19,900원/월",
  team:    "49,900원/월",
};

export default function UpgradeModal({ required, feature, onClose }: Props) {
  const router = useRouter();

  return (
    <div
      className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6 text-center shadow-2xl">
        <div className="text-4xl mb-3">🔒</div>
        <h2 className="text-lg font-bold text-white mb-2">
          {PLAN_LABELS[required]} 플랜이 필요합니다
        </h2>
        {feature && (
          <p className="text-sm text-gray-400 mb-4">
            <span className="text-yellow-400 font-medium">{feature}</span> 기능은{" "}
            {PLAN_LABELS[required]} 플랜 이상에서 이용할 수 있습니다.
          </p>
        )}
        <p className="text-sm text-gray-500 mb-6">{PLAN_PRICES[required]}부터 시작</p>

        <div className="flex gap-2">
          <button
            onClick={() => { router.push("/pricing"); onClose(); }}
            className="flex-1 bg-green-500 hover:bg-green-400 text-black font-semibold text-sm py-2.5 rounded-xl transition-colors"
          >
            요금제 보기
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2.5 rounded-xl transition-colors"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
