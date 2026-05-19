// src/lib/extension-auth.ts
// Chrome 확장 토큰 인증 헬퍼

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export type ExtensionUser = {
  id: string;
  email: string;
  name: string;
};

/**
 * Bearer 토큰으로 사용자 인증 (ExtensionToken 테이블 조회)
 * 성공 시 user 반환, 실패 시 null
 */
export async function authenticateExtension(req: NextRequest): Promise<ExtensionUser | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const record = await prisma.extensionToken.findUnique({
    where: { token },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  if (!record || record.revokedAt) return null;

  // lastUsedAt 비동기 갱신 (응답 지연 없음)
  prisma.extensionToken.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {});

  return record.user;
}

/**
 * 크립토 랜덤 토큰 생성 (32바이트 hex)
 */
export function generateToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
}
