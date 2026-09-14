import { createHmac, timingSafeEqual } from "node:crypto";
import { defineEventHandler, getHeader, getQuery, readBody, setResponseStatus } from "h3";
import { fileReportDb } from "../../src/lib/safelink/persist";

const verifyToken = process.env.META_WHATSAPP_VERIFY_TOKEN;
const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
const appSecret = process.env.META_WHATSAPP_APP_SECRET;

function validSignature(rawBody: string, signature: string | undefined) {
  if (!appSecret || !signature?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const provided = signature.slice(7);
  return provided.length === expected.length && timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

async function sendText(to: string, body: string) {
  if (!accessToken || !phoneNumberId) return;
  await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
  });
}

function replyFor(text: string) {
  const value = text.trim().toLowerCase();
  if (value.includes("hospital")) return "SafeLink hospitals are being located. Reply REPORT to report an emergency.";
  if (value.includes("report") || value === "1") return "Please reply with the emergency type and nearest town or landmark. Example: Accident, Kampala Road.";
  return "SafeLink Uganda emergency assistant. Reply REPORT to report an emergency, HOSPITAL for nearby hospitals, or STATUS for a report update.";
}

export default defineEventHandler(async (event) => {
  if (event.method === "GET") {
    const query = getQuery(event);
    if (query["hub.mode"] === "subscribe" && query["hub.verify_token"] === verifyToken) return String(query["hub.challenge"] ?? "");
    setResponseStatus(event, 403);
    return { error: "Webhook verification failed" };
  }

  if (event.method !== "POST") {
    setResponseStatus(event, 405);
    return { error: "Method not allowed" };
  }

  const rawBody = (await readBody<string>(event)) ?? "";
  const signature = getHeader(event, "x-hub-signature-256");
  if (!validSignature(rawBody, signature)) {
    setResponseStatus(event, 401);
    return { error: "Invalid webhook signature" };
  }

  const payload = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
  const changes = payload?.entry?.flatMap((entry: any) => entry.changes ?? []) ?? [];
  for (const change of changes) {
    const messages = change.value?.messages ?? [];
    for (const message of messages) {
      if (message.type !== "text" || !message.from) continue;
      const text = message.text?.body ?? "";
      await sendText(message.from, replyFor(text));
      if (text.toLowerCase().includes("report")) {
        await fileReportDb({
          type: "Other", location: "WhatsApp caller — location pending", region: "Central", country: "Uganda",
          lat: 0.3476, lng: 32.5825, casualties: 1, desc: `WhatsApp report request: ${text}`,
          source: "WhatsApp Cloud API", reporter: message.from, channel: "WhatsApp", from: message.from,
        });
      }
    }
  }

  return { received: true };
});
