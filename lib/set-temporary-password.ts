export const TEMPORARY_PASSWORD_MIN_LENGTH = 10;
export const TEMPORARY_PASSWORD_MAX_LENGTH = 128;

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export type SetTemporaryPasswordResult =
  | { ok: true; user_id: string; email?: string | null }
  | { ok: false; error: string };

export function generateTemporaryPassword(length = 12): string {
  const size = Math.max(TEMPORARY_PASSWORD_MIN_LENGTH, Math.min(length, TEMPORARY_PASSWORD_MAX_LENGTH));
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length]).join("");
}

export function validateTemporaryPassword(password: unknown): string | null {
  if (typeof password !== "string") return null;
  const value = password.trim();
  if (value.length < TEMPORARY_PASSWORD_MIN_LENGTH) return null;
  if (value.length > TEMPORARY_PASSWORD_MAX_LENGTH) return null;
  if (/\s/.test(value)) return null;
  return value;
}

export async function setTemporaryPassword(
  input: { userId: string; password: string },
  deps: {
    updateUserPassword: (userId: string, password: string) => Promise<{ email?: string | null; error?: string | null }>;
  }
): Promise<SetTemporaryPasswordResult> {
  const userId = input.userId.trim();
  if (!userId) return { ok: false, error: "Student required." };
  const password = validateTemporaryPassword(input.password);
  if (!password) {
    return {
      ok: false,
      error: `Temporary password must be ${TEMPORARY_PASSWORD_MIN_LENGTH}–${TEMPORARY_PASSWORD_MAX_LENGTH} characters with no spaces.`,
    };
  }
  const updated = await deps.updateUserPassword(userId, password);
  if (updated.error) return { ok: false, error: updated.error };
  return { ok: true, user_id: userId, email: updated.email || null };
}
