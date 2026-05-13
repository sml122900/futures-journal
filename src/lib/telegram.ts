// 텔레그램 Bot API 유틸리티

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

type InlineButton = { text: string; url?: string; callback_data?: string };

export async function sendTelegramMessage(
  chatId: string,
  text: string,
  options?: {
    parseMode?: "Markdown" | "MarkdownV2" | "HTML";
    inlineKeyboard?: InlineButton[][];
  }
): Promise<boolean> {
  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: options?.parseMode ?? "MarkdownV2",
    };
    if (options?.inlineKeyboard) {
      body.reply_markup = { inline_keyboard: options.inlineKeyboard };
    }
    const res = await fetch(`${API_BASE}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[telegram] sendMessage failed", err);
    }
    return res.ok;
  } catch (err) {
    console.error("[telegram] sendMessage error", err);
    return false;
  }
}

export async function getBotInfo(): Promise<{ username: string } | null> {
  try {
    const res = await fetch(`${API_BASE}/getMe`);
    if (!res.ok) return null;
    const data = await res.json();
    return { username: data.result?.username ?? "" };
  } catch {
    return null;
  }
}

export async function setWebhook(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    return res.ok;
  } catch (err) {
    console.error("[telegram] setWebhook error", err);
    return false;
  }
}

export function generateLinkCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
