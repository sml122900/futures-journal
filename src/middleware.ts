// src/middleware.ts
// Chrome 확장 API 라우트에 CORS 헤더 추가
// 크롬 확장 content script의 fetch는 www.bitget.com을 Origin으로 전송함
// → 서버에서 명시적으로 허용해야 함

import { NextRequest, NextResponse } from 'next/server';

const EXTENSION_API_PREFIXES = [
  '/api/emergency-check',
  '/api/extension/',
  '/api/emergency/cancel',
  '/api/emergency/proceed',
];

function needsCors(pathname: string): boolean {
  return EXTENSION_API_PREFIXES.some(p => pathname.startsWith(p));
}

function resolveCorsOrigin(origin: string | null): string {
  if (!origin) return '*';
  if (origin.startsWith('chrome-extension://')) return origin;
  if (origin === 'https://www.bitget.com') return origin;
  // 그 외 알려진 안전한 origin
  return '*';
}

const CORS_HEADERS = (origin: string | null) => ({
  'Access-Control-Allow-Origin': resolveCorsOrigin(origin),
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
});

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!needsCors(pathname)) {
    return NextResponse.next();
  }

  const origin = req.headers.get('origin');
  const headers = CORS_HEADERS(origin);

  // OPTIONS preflight — 실제 요청 전 브라우저가 먼저 보내는 확인 요청
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers });
  }

  const response = NextResponse.next();
  Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
