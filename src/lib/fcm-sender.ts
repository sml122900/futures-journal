import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import prisma from "@/lib/prisma";

function initFirebase() {
  if (getApps().length > 0) return;
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    }),
  });
}

export interface EmergencyPushPayload {
  sessionId: string;
  level: number;
  symbol: string;
  side: string;
  size: number;
  sizeMultiplier: number;
  triggers: string[];
  forceSentence: string;
  countdown: number;
}

export async function sendEmergencyPush(
  userId: string,
  payload: EmergencyPushPayload
): Promise<boolean> {
  if (
    !process.env.FIREBASE_PROJECT_ID ||
    !process.env.FIREBASE_CLIENT_EMAIL ||
    !process.env.FIREBASE_PRIVATE_KEY
  ) {
    console.warn("[FCM] Firebase env vars not set, skipping push");
    return false;
  }

  try {
    initFirebase();
  } catch (e) {
    console.error("[FCM] Firebase init failed", e);
    return false;
  }

  const devices = await prisma.deviceRegistration.findMany({
    where: { userId, platform: "android" },
  });

  if (devices.length === 0) return false;

  const messaging = getMessaging();
  let sent = 0;

  for (const device of devices) {
    try {
      await messaging.send({
        token: device.fcmToken,
        data: {
          type: "emergency",
          sessionId: payload.sessionId,
          level: payload.level.toString(),
          symbol: payload.symbol,
          side: payload.side,
          size: payload.size.toString(),
          sizeMultiplier: payload.sizeMultiplier.toString(),
          triggers: payload.triggers.join(","),
          forceSentence: payload.forceSentence,
          countdown: payload.countdown.toString(),
        },
        android: {
          priority: "high",
        },
      });
      await prisma.deviceRegistration.update({
        where: { id: device.id },
        data: { lastSeenAt: new Date() },
      });
      sent++;
    } catch (e) {
      console.error("[FCM] send failed for device", device.id, e);
      // 토큰 만료 에러 시 DB에서 제거
      const errMsg = String(e);
      if (
        errMsg.includes("registration-token-not-registered") ||
        errMsg.includes("invalid-registration-token")
      ) {
        await prisma.deviceRegistration.delete({ where: { id: device.id } }).catch(() => {});
      }
    }
  }

  return sent > 0;
}
