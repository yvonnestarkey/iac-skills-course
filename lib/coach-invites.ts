import { isCoachAccount } from "@/lib/roles";
import type { EntitlementStatus } from "@/lib/commerce";
import { normalizeEntitlementSource, type EntitlementSource } from "@/lib/account-access";
import type { StudentUser } from "@/lib/student-lesson";

/** Never flip this on. Deploying the app must not email the waitlist. */
export const AUTO_SEND_WAITLIST_ON_DEPLOY = false;

export const WAITLIST_INVITE_ACCESS = "free_preview" as const;

export type InviteAccess = "free_preview" | "full_complimentary";
export type InviteAction = "invite_waitlist" | "add_student";
export type WaitlistInvitationStatus = "waiting" | "invited" | "existing_account" | "granted";

export type CoachInviteRequest = {
  action: InviteAction;
  confirm: boolean;
  access?: InviteAccess;
  lead_ids?: string[];
  name?: string;
  email?: string;
};

export type InviteTarget = {
  email: string;
  name: string;
  lead_id?: string;
  access: InviteAccess;
};

export type FoundAuthUser = {
  id: string;
  email: string;
  created?: boolean;
};

export type EntitlementRecord = {
  status: EntitlementStatus;
  source: EntitlementSource;
};

export type InviteOutcome = {
  email: string;
  name: string;
  lead_id?: string;
  access: InviteAccess;
  account_existed: boolean;
  auth_user_created: boolean;
  password_changed: false;
  email_sent: boolean;
  entitlement_granted: boolean;
  entitlement_status: EntitlementStatus;
  entitlement_source: EntitlementSource;
  created_stripe_purchase: false;
  created_referral: false;
  waitlist_status: WaitlistInvitationStatus;
  message: string;
};

export type CoachInviteResult = {
  ok: boolean;
  error?: string;
  status: number;
  emails_sent: number;
  outcomes: InviteOutcome[];
};

export type AdminEventInput = {
  actor_id: string;
  action: "waitlist_invite" | "add_student_invite" | "grant_preview" | "grant_complimentary";
  target_email: string;
  target_user_id?: string | null;
  waitlist_id?: string | null;
  payload: Record<string, unknown>;
};

export type CoachInviteDeps = {
  findUserByEmail: (email: string) => Promise<FoundAuthUser | null>;
  inviteUserByEmail: (
    email: string,
    options: { data?: object; redirectTo?: string }
  ) => Promise<{ user: FoundAuthUser | null; error: string | null }>;
  getEntitlement: (userId: string) => Promise<EntitlementRecord | null>;
  grantPreview: (userId: string) => Promise<void>;
  grantComplimentary: (userId: string) => Promise<void>;
  upsertProfile: (userId: string, email: string, name: string) => Promise<void>;
  updateWaitlist: (
    leadId: string,
    patch: {
      invitation_status: WaitlistInvitationStatus;
      invited_at?: string;
      invited_by?: string;
      invited_user_id?: string;
      invitation_access?: InviteAccess;
    }
  ) => Promise<void>;
  logEvent: (event: AdminEventInput) => Promise<void>;
  siteUrl: string;
};

export function invitationRedirectUrl(base: string): string {
  return `${base.replace(/\/$/, "")}/auth/update-password?type=invite`;
}

export function normalizeInviteEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function coachMayUseInviteEndpoints(user: StudentUser | null | undefined): boolean {
  return isCoachAccount(user);
}

export function waitlistInviteAccess(): InviteAccess {
  return WAITLIST_INVITE_ACCESS;
}

export function complimentaryCreatesStripePurchase(): false {
  return false;
}

export function wouldSendInvitationsOnDeploy(): boolean {
  return AUTO_SEND_WAITLIST_ON_DEPLOY;
}

export function requestedAccess(input: CoachInviteRequest): InviteAccess {
  if (input.action === "invite_waitlist") return WAITLIST_INVITE_ACCESS;
  return input.access === "full_complimentary" ? "full_complimentary" : "free_preview";
}

export function resolveInviteTargets(
  input: CoachInviteRequest,
  leads: Array<{ id: string; email: string; full_name: string }> = []
): { ok: true; targets: InviteTarget[] } | { ok: false; error: string } {
  const access = requestedAccess(input);
  if (input.action === "add_student") {
    const email = normalizeInviteEmail(input.email || "");
    const name = (input.name || "").trim();
    if (!name || !email || !email.includes("@")) {
      return { ok: false, error: "Enter a name and a valid email." };
    }
    return { ok: true, targets: [{ email, name, access }] };
  }

  const ids = [...new Set((input.lead_ids || []).filter(Boolean))];
  if (!ids.length) return { ok: false, error: "Select at least one waitlist person." };
  const byId = new Map(leads.map((lead) => [lead.id, lead]));
  const targets: InviteTarget[] = [];
  for (const id of ids) {
    const lead = byId.get(id);
    if (!lead) return { ok: false, error: "A selected waitlist person could not be found." };
    targets.push({
      email: normalizeInviteEmail(lead.email),
      name: lead.full_name.trim() || lead.email,
      lead_id: lead.id,
      access,
    });
  }
  return { ok: true, targets };
}

export function shouldSendInviteEmail(input: { confirm: boolean; accountExists: boolean }): boolean {
  return Boolean(input.confirm) && !input.accountExists && !AUTO_SEND_WAITLIST_ON_DEPLOY;
}

export function shouldGrantAccess(
  current: EntitlementRecord | null,
  requested: InviteAccess
): { grant: boolean; reason: "needed" | "already_preview" | "already_full" } {
  if (requested === "full_complimentary") {
    if (current?.status === "full") return { grant: false, reason: "already_full" };
    return { grant: true, reason: "needed" };
  }
  if (current?.status === "full") return { grant: false, reason: "already_full" };
  if (current?.status === "free_preview") return { grant: false, reason: "already_preview" };
  return { grant: true, reason: "needed" };
}

export function resultingEntitlement(
  current: EntitlementRecord | null,
  requested: InviteAccess,
  granted: boolean
): EntitlementRecord {
  if (current?.status === "full") return current;
  if (granted && requested === "full_complimentary") {
    return { status: "full", source: "admin" };
  }
  if (current?.status === "free_preview") return current;
  return { status: "free_preview", source: "signup" };
}

export async function processCoachInvite(
  input: CoachInviteRequest,
  actor: StudentUser | null,
  leads: Array<{ id: string; email: string; full_name: string }>,
  deps: CoachInviteDeps
): Promise<CoachInviteResult> {
  if (!coachMayUseInviteEndpoints(actor) || !actor) {
    return { ok: false, error: "Coach access required.", status: 403, emails_sent: 0, outcomes: [] };
  }
  if (AUTO_SEND_WAITLIST_ON_DEPLOY) {
    return { ok: false, error: "Automatic waitlist invitations are disabled.", status: 500, emails_sent: 0, outcomes: [] };
  }
  if (!input.confirm) {
    return { ok: false, error: "Confirm Send invitation before anyone is emailed.", status: 400, emails_sent: 0, outcomes: [] };
  }

  const resolved = resolveInviteTargets(input, leads);
  if (resolved.ok === false) {
    return { ok: false, error: resolved.error, status: 400, emails_sent: 0, outcomes: [] };
  }

  const outcomes: InviteOutcome[] = [];
  let emailsSent = 0;
  const now = new Date().toISOString();

  for (const target of resolved.targets) {
    const existing = await deps.findUserByEmail(target.email);
    let userId = existing?.id || "";
    let accountExisted = Boolean(existing);
    let authCreated = false;
    let emailSent = false;

    if (!existing) {
      if (!shouldSendInviteEmail({ confirm: true, accountExists: false })) {
        return { ok: false, error: "Invitation sending is disabled.", status: 500, emails_sent: emailsSent, outcomes };
      }
      const invited = await deps.inviteUserByEmail(target.email, {
        data: { full_name: target.name },
        redirectTo: invitationRedirectUrl(deps.siteUrl),
      });
      if (invited.error || !invited.user) {
        outcomes.push({
          ...baseOutcome(target),
          message: invited.error || "Could not send the invitation.",
        });
        continue;
      }
      userId = invited.user.id;
      authCreated = true;
      emailSent = true;
      emailsSent += 1;
    }

    await deps.upsertProfile(userId, target.email, target.name);
    const current = await deps.getEntitlement(userId);
    const decision = shouldGrantAccess(current, target.access);
    if (decision.grant) {
      if (target.access === "full_complimentary") await deps.grantComplimentary(userId);
      else await deps.grantPreview(userId);
    }
    const next = resultingEntitlement(current, target.access, decision.grant);
    const waitlistStatus: WaitlistInvitationStatus = accountExisted
      ? decision.grant
        ? "granted"
        : "existing_account"
      : "invited";

    if (target.lead_id) {
      await deps.updateWaitlist(target.lead_id, {
        invitation_status: waitlistStatus,
        invited_at: now,
        invited_by: actor.id,
        invited_user_id: userId,
        invitation_access: target.access,
      });
    }

    await deps.logEvent({
      actor_id: actor.id,
      action: accountExisted
        ? target.access === "full_complimentary"
          ? "grant_complimentary"
          : "grant_preview"
        : input.action === "invite_waitlist"
          ? "waitlist_invite"
          : "add_student_invite",
      target_email: target.email,
      target_user_id: userId,
      waitlist_id: target.lead_id || null,
      payload: {
        access: target.access,
        account_existed: accountExisted,
        email_sent: emailSent,
        entitlement_granted: decision.grant,
      },
    });

    outcomes.push({
      email: target.email,
      name: target.name,
      lead_id: target.lead_id,
      access: target.access,
      account_existed: accountExisted,
      auth_user_created: authCreated,
      password_changed: false,
      email_sent: emailSent,
      entitlement_granted: decision.grant,
      entitlement_status: next.status,
      entitlement_source: next.source,
      created_stripe_purchase: false,
      created_referral: false,
      waitlist_status: waitlistStatus,
      message: accountExisted
        ? decision.grant
          ? `Account already exists. ${target.access === "full_complimentary" ? "Complimentary full access" : "Free-preview access"} was granted. Password was not changed.`
          : next.status === "full"
            ? "Account already exists and already has full course access. Password was not changed."
            : "Account already exists and already has free-preview access. Password was not changed."
        : target.access === "full_complimentary"
          ? "Invitation sent. After they set a password they will have complimentary full course access."
          : "Invitation sent. After they set a password they will have free-preview access.",
    });
  }

  return { ok: true, status: 200, emails_sent: emailsSent, outcomes };
}

function baseOutcome(target: InviteTarget): InviteOutcome {
  return {
    email: target.email,
    name: target.name,
    lead_id: target.lead_id,
    access: target.access,
    account_existed: false,
    auth_user_created: false,
    password_changed: false,
    email_sent: false,
    entitlement_granted: false,
    entitlement_status: target.access === "full_complimentary" ? "full" : "free_preview",
    entitlement_source: target.access === "full_complimentary" ? "admin" : "signup",
    created_stripe_purchase: false,
    created_referral: false,
    waitlist_status: "waiting",
    message: "Invitation was not sent.",
  };
}
