import {
  accountActivationStatus,
  recentlySentRecovery,
  type AuthActivationSnapshot,
} from "@/lib/account-activation";
import { passwordResetRedirectUrl } from "@/lib/invite-session";

export type PasswordSetupSendResult = {
  ok: true;
  emailed: boolean;
  created_user: false;
  entitlement_changed: false;
  reason: "sent" | "recently_sent" | "not_found" | "send_failed";
  message: string;
};

export type PasswordSetupDeps = {
  findUser: (email: string) => Promise<AuthActivationSnapshot | null>;
  confirmEmail: (userId: string) => Promise<void>;
  sendRecoveryEmail: (email: string, redirectTo: string) => Promise<{ error: string | null }>;
  siteUrl: string;
  now?: Date;
};

export const ACTIVATE_PATH = "/activate";

export function shouldCreateAuthUserForPasswordSetup(): false {
  return false;
}

export function publicActivateUrl(origin = "https://iac.accountingstudyadvice.com"): string {
  return `${origin.replace(/\/$/, "")}${ACTIVATE_PATH}`;
}

export function activatePageHeading(): string {
  return "Activate your Free Preview";
}

export function activatePageBody(): string {
  return "Already have a Free Preview? Enter the email address your invitation was sent to and we'll send you a secure link to set your password.";
}

export function activatePageCta(): string {
  return "Send my activation link";
}

export function activateInboxHeading(): string {
  return "Check your inbox";
}

export function activateInboxBody(): string {
  return "If an account exists for that email, we've sent you a secure link to set up your password. Please also check your spam or junk folder.";
}

export function loginActivatePrompt(): string {
  return "Have a Free Preview but haven't activated your account yet?";
}

export function loginActivateLinkLabel(): string {
  return "Activate your account →";
}

export function loginForgotPasswordHint(): string {
  return "Forgot password is for students who have already set a password.";
}

export function publicPasswordSetupCopy(): string {
  return "If we have a student account for that email, we sent a new password setup link. It does not change your course access.";
}

export async function sendExistingUserPasswordSetup(
  email: string,
  deps: PasswordSetupDeps
): Promise<PasswordSetupSendResult> {
  const normalized = email.trim().toLowerCase();
  const none: PasswordSetupSendResult = {
    ok: true,
    emailed: false,
    created_user: false,
    entitlement_changed: false,
    reason: "not_found",
    message: publicPasswordSetupCopy(),
  };
  if (!normalized || !normalized.includes("@")) return none;

  try {
    const user = await deps.findUser(normalized);
    if (!user) return none;

    if (recentlySentRecovery(user.recovery_sent_at, deps.now)) {
      return {
        ok: true,
        emailed: false,
        created_user: false,
        entitlement_changed: false,
        reason: "recently_sent",
        message: publicPasswordSetupCopy(),
      };
    }

    const status = accountActivationStatus(user);
    if (!user.email_confirmed_at && (user.invited_at || status === "needs_activation")) {
      await deps.confirmEmail(user.user_id);
    }

    const sent = await deps.sendRecoveryEmail(normalized, passwordResetRedirectUrl(deps.siteUrl));
    if (sent.error) {
      return {
        ok: true,
        emailed: false,
        created_user: false,
        entitlement_changed: false,
        reason: "send_failed",
        message: sent.error,
      };
    }

    return {
      ok: true,
      emailed: true,
      created_user: false,
      entitlement_changed: false,
      reason: "sent",
      message: publicPasswordSetupCopy(),
    };
  } catch (error) {
    return {
      ok: true,
      emailed: false,
      created_user: false,
      entitlement_changed: false,
      reason: "send_failed",
      message: error instanceof Error ? error.message : "Could not send a password setup link.",
    };
  }
}
