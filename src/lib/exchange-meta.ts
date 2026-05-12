// 지원 거래소 설정
export type ExchangeSlug = 'binance' | 'bybit' | 'okx' | 'bitget' | 'bingx';

export const EXCHANGES: Record<ExchangeSlug, {
  name: string;
  color: string;
  bgColor: string;
  hasPassphrase: boolean;
  guideSteps: string[];
}> = {
  binance: {
    name: '바이낸스',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10 border-yellow-400/20',
    hasPassphrase: false,
    guideSteps: [
      '바이낸스 로그인 → 우측 상단 프로필 아이콘 클릭',
      '드롭다운 메뉴에서 [API 관리] 선택',
      '[API 생성] 클릭 → 라벨(이름) 입력 후 확인',
      'IP 접근 제한: [IP 제한 없음] 선택',
      '권한 설정: [선물 읽기] 체크 — 출금·거래 권한은 절대 체크 금지',
      '이메일 + 2FA 인증 완료',
      'API Key와 Secret Key를 복사해 이전 화면에 입력',
    ],
  },
  bybit: {
    name: '바이비트',
    color: 'text-orange-400',
    bgColor: 'bg-orange-400/10 border-orange-400/20',
    hasPassphrase: false,
    guideSteps: [
      '바이비트 로그인 → 우측 상단 프로필 클릭',
      '[My API] 선택',
      '[API 키 생성] 클릭',
      '키 이름 입력, 유형: [시스템 생성] 선택',
      '권한: [읽기 전용] 선택 — 다른 권한 체크 금지',
      '2FA 인증 완료',
      'API Key와 Secret Key를 복사해 이전 화면에 입력',
    ],
  },
  okx: {
    name: 'OKX',
    color: 'text-white',
    bgColor: 'bg-white/10 border-white/20',
    hasPassphrase: true,
    guideSteps: [
      'OKX 로그인 → 우측 상단 프로필 클릭',
      '[API] 선택',
      '[API 생성] 클릭',
      'API 이름 입력, Passphrase 직접 설정 (기억해두기)',
      '권한: [읽기] 선택 — 거래·출금 권한 체크 금지',
      'IP 바인딩: 비워두기',
      'API Key, Secret Key, Passphrase를 복사해 이전 화면에 입력',
    ],
  },
  bitget: {
    name: '비트겟',
    color: 'text-teal-400',
    bgColor: 'bg-teal-400/10 border-teal-400/20',
    hasPassphrase: true,
    guideSteps: [
      '비트겟 로그인 → 우측 상단 프로필 클릭',
      '[API 관리] 선택',
      '[API 생성] 클릭',
      'API 이름 입력, Passphrase 직접 설정 (기억해두기)',
      '권한: [읽기 전용] 선택 — 출금·거래 권한 절대 체크 금지',
      '이메일 + 2FA 인증 완료',
      'API Key, Secret Key, Passphrase를 복사해 이전 화면에 입력',
    ],
  },
  bingx: {
    name: '빙엑스',
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10 border-blue-400/20',
    hasPassphrase: false,
    guideSteps: [
      '빙엑스 로그인 → 우측 상단 프로필 클릭',
      '[API 관리] 선택',
      '[API 생성] 클릭',
      'API 이름 입력',
      '권한: [읽기 전용] 선택 — 출금·거래 권한 체크 금지',
      '이메일 + 2FA 인증 완료',
      'API Key와 Secret Key를 복사해 이전 화면에 입력',
    ],
  },
};

export const EXCHANGE_SLUGS = Object.keys(EXCHANGES) as ExchangeSlug[];

export function isValidExchange(slug: string): slug is ExchangeSlug {
  return slug in EXCHANGES;
}
