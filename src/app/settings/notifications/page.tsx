'use client';
// 알림 설정 페이지 — 텔레그램 연동 + 알림 종류별 토글
import { useState, useEffect, useCallback } from "react";

interface NotifSettings {
  telegramLinked: boolean;
  telegramChatId: string | null;
  emailEnabled: boolean;
  ruleViolation: boolean;
  largeLoss: boolean;
  liquidationRisk: boolean;
  memoReminder: boolean;
  weeklyReport: boolean;
  milestoneAlert: boolean;
}

interface LinkInfo {
  code: string;
  botUsername: string;
  expiresAt: string;
}

const TOGGLES: { key: keyof Omit<NotifSettings, 'telegramLinked' | 'telegramChatId'>; label: string; desc: string }[] = [
  { key: "ruleViolation",  label: "룰 위반",            desc: "등록한 거래 룰을 위반했을 때" },
  { key: "largeLoss",      label: "큰 손실 (-3% 이상)", desc: "포지션이 -3% 이상 손실로 종료됐을 때" },
  { key: "liquidationRisk",label: "청산 위험 (MMR 70%+)",desc: "계좌 청산 위험이 70% 이상일 때" },
  { key: "memoReminder",   label: "메모 리마인더",       desc: "24시간 이상 회고 메모 미작성 포지션이 있을 때 (매일 자정)" },
  { key: "weeklyReport",   label: "주간 리포트",         desc: "주간 AI 분석 리포트 생성 시 (매주 일요일)" },
  { key: "milestoneAlert", label: "마일스톤 달성",       desc: "새 마일스톤 달성 시" },
];

export default function NotificationsPage() {
  const [settings, setSettings] = useState<NotifSettings | null>(null);
  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [linking, setLinking] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/settings");
      const json = await res.json();
      if (json.success) setSettings(json.settings);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const showStatus = (msg: string, ok: boolean) => {
    setStatus({ msg, ok });
    setTimeout(() => setStatus(null), 3000);
  };

  const handleGenerateCode = async () => {
    setLinking(true);
    try {
      const res = await fetch("/api/notifications/telegram/link", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setLinkInfo({ code: json.code, botUsername: json.botUsername, expiresAt: json.expiresAt });
      } else {
        showStatus("코드 생성 실패", false);
      }
    } catch {
      showStatus("오류가 발생했습니다", false);
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm("텔레그램 연동을 해제할까요?")) return;
    try {
      const res = await fetch("/api/notifications/telegram/unlink", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setSettings(prev => prev ? { ...prev, telegramLinked: false, telegramChatId: null } : prev);
        setLinkInfo(null);
        showStatus("연동이 해제됐습니다", true);
      }
    } catch {
      showStatus("오류가 발생했습니다", false);
    }
  };

  const handleCheckLink = async () => {
    try {
      const res = await fetch("/api/notifications/telegram/link");
      const json = await res.json();
      if (json.linked) {
        setSettings(prev => prev ? { ...prev, telegramLinked: true, telegramChatId: json.chatId } : prev);
        setLinkInfo(null);
        showStatus("연동 완료!", true);
      } else {
        showStatus("아직 연동되지 않았습니다. 봇에서 /link 코드를 입력해주세요.", false);
      }
    } catch {}
  };

  const handleToggle = async (key: keyof NotifSettings) => {
    if (!settings) return;
    const next = { ...settings, [key]: !settings[key as keyof NotifSettings] };
    setSettings(next);
    try {
      await fetch("/api/notifications/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next[key as keyof NotifSettings] }),
      });
    } catch {
      setSettings(settings); // 실패 시 롤백
    }
  };

  const handleTest = async () => {
    setTestSending(true);
    try {
      const res = await fetch("/api/notifications/test", { method: "POST" });
      const json = await res.json();
      showStatus(json.success ? "테스트 알림을 전송했습니다!" : json.message ?? "발송 실패", json.success);
    } catch {
      showStatus("오류가 발생했습니다", false);
    } finally {
      setTestSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-[var(--text-secondary)] text-sm">로딩 중...</div>
      </div>
    );
  }

  const linked = settings?.telegramLinked ?? false;
  const chatId = settings?.telegramChatId;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">알림 설정</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">텔레그램으로 실시간 알림을 받을 수 있습니다.</p>
        </div>

        {status && (
          <div className={`text-sm px-4 py-2 rounded-lg ${status.ok ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
            {status.msg}
          </div>
        )}

        {/* 텔레그램 연동 섹션 */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">✈️</span>
            <div>
              <h2 className="font-semibold text-[var(--text-primary)]">텔레그램 연동</h2>
              <p className="text-xs text-[var(--text-secondary)]">봇과 연동하면 모든 알림을 텔레그램으로 받습니다</p>
            </div>
            {linked && (
              <span className="ml-auto text-xs bg-green-500/10 text-green-400 border border-green-500/30 px-2 py-1 rounded-full">
                연동됨
              </span>
            )}
          </div>

          {linked ? (
            <div className="space-y-3">
              <div className="text-sm text-[var(--text-secondary)] bg-[var(--bg-primary)] rounded-lg px-3 py-2">
                Chat ID: {chatId ? `${chatId.slice(0, 3)}****` : "—"}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleTest}
                  disabled={testSending}
                  className="flex-1 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  {testSending ? "발송 중..." : "🔔 테스트 알림 보내기"}
                </button>
                <button
                  onClick={handleUnlink}
                  className="text-sm bg-[var(--bg-primary)] hover:bg-red-500/10 text-red-400 border border-[var(--border-primary)] px-4 py-2 rounded-lg transition-colors"
                >
                  연동 해제
                </button>
              </div>
            </div>
          ) : linkInfo ? (
            <div className="space-y-4">
              <div className="bg-[var(--bg-primary)] rounded-lg p-4 space-y-2">
                <p className="text-sm text-[var(--text-secondary)]">1. 텔레그램에서 아래 봇을 찾아 시작하세요</p>
                <a
                  href={`https://t.me/${linkInfo.botUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 text-sm hover:underline"
                >
                  @{linkInfo.botUsername}
                </a>
                <p className="text-sm text-[var(--text-secondary)] mt-2">2. 봇에게 다음 명령어를 보내세요:</p>
                <div className="font-mono text-base font-bold text-[var(--text-primary)] bg-[var(--bg-secondary)] px-4 py-3 rounded-lg tracking-widest">
                  /link {linkInfo.code}
                </div>
                <p className="text-xs text-[var(--text-tertiary)]">
                  유효 시간: {new Date(linkInfo.expiresAt).toLocaleTimeString("ko-KR")}까지 (10분)
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCheckLink}
                  className="flex-1 text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  ✓ 연동 완료 확인
                </button>
                <button
                  onClick={() => setLinkInfo(null)}
                  className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-4 py-2 rounded-lg transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleGenerateCode}
              disabled={linking}
              className="w-full text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
            >
              {linking ? "코드 생성 중..." : "텔레그램 연동하기"}
            </button>
          )}
        </div>

        {/* 알림 종류 토글 */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl p-5">
          <h2 className="font-semibold text-[var(--text-primary)] mb-4">알림 종류</h2>
          {!linked && (
            <p className="text-xs text-[var(--text-secondary)] mb-4 bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 rounded-lg">
              텔레그램 연동 후 알림을 받을 수 있습니다
            </p>
          )}
          <div className="space-y-1">
            {TOGGLES.map(({ key, label, desc }) => (
              <div
                key={key}
                className="flex items-center justify-between py-3 border-b border-[var(--border-primary)] last:border-0"
              >
                <div>
                  <div className="text-sm font-medium text-[var(--text-primary)]">{label}</div>
                  <div className="text-xs text-[var(--text-secondary)] mt-0.5">{desc}</div>
                </div>
                <button
                  onClick={() => handleToggle(key)}
                  disabled={!linked}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    settings?.[key] && linked
                      ? "bg-blue-600"
                      : "bg-[var(--bg-primary)]"
                  } border border-[var(--border-primary)] disabled:opacity-40`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      settings?.[key] && linked ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-[var(--text-tertiary)] text-center">
          Webhook URL 설정은 Vercel 배포 후 자동으로 활성화됩니다.<br />
          로컬 테스트는 ngrok을 통해 수동으로 설정할 수 있습니다.
        </p>
      </div>
    </div>
  );
}
