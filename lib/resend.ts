import { REGISTRATION_CONTACT_EMAIL } from "@/lib/sales-copy";

export const RESEND_API_URL = "https://api.resend.com/emails";
export const DEFAULT_RESEND_FROM = `Accounting Study Advice <${REGISTRATION_CONTACT_EMAIL}>`;

export type ResendEmailPayload = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  from?: string;
  idempotencyKey?: string;
};

export function resendApiKey(env: Record<string, string | undefined> = process.env): string | null {
  const value = env.RESEND_API_KEY?.trim();
  return value || null;
}

export function resendFromAddress(env: Record<string, string | undefined> = process.env): string {
  return env.RESEND_FROM_EMAIL?.trim() || DEFAULT_RESEND_FROM;
}

export async function sendResendEmail(
  payload: ResendEmailPayload,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch
): Promise<{ id: string }> {
  const key = resendApiKey(env);
  if (!key) throw new Error("RESEND_API_KEY is not configured.");
  const to = Array.isArray(payload.to) ? payload.to : [payload.to];
  const response = await fetchImpl(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(payload.idempotencyKey ? { "Idempotency-Key": payload.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: payload.from || resendFromAddress(env),
      to,
      subject: payload.subject,
      text: payload.text,
      ...(payload.html ? { html: payload.html } : {}),
    }),
  });
  const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string; error?: { message?: string } };
  if (!response.ok) {
    throw new Error(body.error?.message || body.message || `Resend request failed (${response.status}).`);
  }
  return { id: body.id || "" };
}
