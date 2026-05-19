"use client";
// Chrome 확장 토큰 관리 페이지

import { useState, useEffect, useCallback } from "react";

interface ExtensionTokenRecord {
  id: string;
  name: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function ExtensionSettingsPage() {
  const [tokens, setTokens] = useState<ExtensionTokenRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTokens = useCallback(async () => {
    try {
      const res = await fetch("/api/extension/token");
      if (!res.ok) throw new Error("load failed");
      const data = await res.json();
      setTokens(data.tokens ?? []);
    } catch {
      setError("토큰 목록을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTokens(); }, [loadTokens]);

  async function issueToken() {
    setIssuing(true);
    setError(null);
    setIssuedToken(null);
    try {
      const res = await fetch("/api/extension/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: deviceName.trim() || undefined }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "발급 실패");
      }
      const data = await res.json();
      setIssuedToken(data.token);
      setDeviceName("");
      await loadTokens();
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류 발생");
    } finally {
      setIssuing(false);
    }
  }

  async function revokeToken(id: string) {
    if (!confirm("이 토큰을 폐기하시겠습니까?")) return;
    try {
      await fetch(`/api/extension/token?id=${id}`, { method: "DELETE" });
      await loadTokens();
    } catch {
      setError("폐기 실패");
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "32px 16px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
        Chrome 확장 토큰
      </h1>
      <p style={{ color: "#666", marginBottom: 32 }}>
        크롬 확장에서 이 토큰을 입력하면 Emergency Brake가 활성화됩니다.
        토큰은 비밀번호처럼 관리하세요.
      </p>

      {/* 발급 폼 */}
      <div style={{
        background: "#f9fafb", border: "1px solid #e5e7eb",
        borderRadius: 10, padding: 20, marginBottom: 24,
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>새 토큰 발급</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            type="text"
            value={deviceName}
            onChange={e => setDeviceName(e.target.value)}
            placeholder="기기 이름 (선택, 예: MacBook Pro)"
            style={{
              flex: 1, padding: "8px 12px",
              border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14,
            }}
            maxLength={50}
          />
          <button
            onClick={issueToken}
            disabled={issuing}
            style={{
              padding: "8px 18px", background: "#c00000", color: "#fff",
              border: "none", borderRadius: 6, fontWeight: 600,
              cursor: issuing ? "not-allowed" : "pointer", opacity: issuing ? 0.6 : 1,
            }}
          >
            {issuing ? "발급 중..." : "발급"}
          </button>
        </div>

        {issuedToken && (
          <div style={{
            background: "#f0fdf4", border: "1px solid #bbf7d0",
            borderRadius: 6, padding: 12,
          }}>
            <p style={{ fontSize: 13, color: "#166534", marginBottom: 6 }}>
              ✅ 토큰이 발급되었습니다. 지금 바로 복사하세요 — 다시 표시되지 않습니다.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <code style={{
                flex: 1, background: "#fff", padding: "8px 10px",
                border: "1px solid #d1d5db", borderRadius: 4, fontSize: 13,
                wordBreak: "break-all", fontFamily: "monospace",
              }}>
                {issuedToken}
              </code>
              <button
                onClick={() => { navigator.clipboard.writeText(issuedToken); }}
                style={{
                  padding: "8px 12px", background: "#166534", color: "#fff",
                  border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13,
                  flexShrink: 0,
                }}
              >
                복사
              </button>
            </div>
          </div>
        )}

        {error && (
          <p style={{ color: "#c00000", fontSize: 13, marginTop: 8 }}>{error}</p>
        )}
      </div>

      {/* 토큰 목록 */}
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>발급된 토큰</h2>
      {loading ? (
        <p style={{ color: "#888" }}>불러오는 중...</p>
      ) : tokens.length === 0 ? (
        <p style={{ color: "#888" }}>발급된 토큰이 없습니다.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tokens.map(t => (
            <div key={t.id} style={{
              background: "#fff", border: "1px solid #e5e7eb",
              borderRadius: 8, padding: "12px 16px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: 14 }}>
                  {t.name || "이름 없음"}
                </p>
                <p style={{ color: "#888", fontSize: 12, marginTop: 2 }}>
                  발급: {new Date(t.createdAt).toLocaleDateString("ko-KR")}
                  {t.lastUsedAt ? ` · 마지막 사용: ${new Date(t.lastUsedAt).toLocaleDateString("ko-KR")}` : " · 미사용"}
                </p>
              </div>
              <button
                onClick={() => revokeToken(t.id)}
                style={{
                  padding: "6px 12px", background: "#fee2e2", color: "#c00000",
                  border: "none", borderRadius: 6, cursor: "pointer",
                  fontSize: 13, fontWeight: 600,
                }}
              >
                폐기
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{
        marginTop: 32, padding: 16, background: "#fffbeb",
        border: "1px solid #fde68a", borderRadius: 8, fontSize: 13, color: "#92400e",
      }}>
        <strong>설치 방법</strong><br />
        1. <a
          href="https://github.com"
          style={{ color: "#c00000" }}
          target="_blank" rel="noopener noreferrer"
        >Chrome 확장 설치</a> (개발자 모드)<br />
        2. 위에서 토큰 발급 후 복사<br />
        3. 확장 팝업 아이콘 클릭 → 토큰 붙여넣기
      </div>
    </div>
  );
}
