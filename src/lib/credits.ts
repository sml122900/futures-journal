// 크레딧 시스템 상수 및 유틸

export const SIGNUP_BONUS = 30;

export const CREDIT_COSTS: Record<string, number> = {
  "gemini-2.0-flash-lite": 5,
  "gemini-2.0-flash":      10,
  "gemini-1.5-pro":        30,
  "claude-sonnet-4-6":     15,
  "claude-opus-4-7":       50,
};

export const PACKAGES = [
  { id: "starter", name: "스타터", credits: 100,  priceKrw: 1000  },
  { id: "basic",   name: "베이직", credits: 350,  priceKrw: 3000  },
  { id: "pro",     name: "프로",   credits: 1000, priceKrw: 7500  },
  { id: "heavy",   name: "헤비",   credits: 3000, priceKrw: 20000 },
] as const;

export type PackageId = typeof PACKAGES[number]["id"];
export type Package = typeof PACKAGES[number];

export function getPackage(id: string): Package | undefined {
  return PACKAGES.find(p => p.id === id);
}
