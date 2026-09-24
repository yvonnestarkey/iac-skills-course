import { DEFAULT_COHORT_ID } from "@/lib/cohorts";
import {
  getEntitlementRecord,
  grantFullEntitlement,
  grantPreviewEntitlement,
} from "@/lib/commerce";
import {
  invitationRedirectUrl,
  type CoachInviteDeps,
  type FoundAuthUser,
  type WaitlistInvitationStatus,
  type InviteAccess,
} from "@/lib/coach-invites";
import { getServiceSupabase } from "@/lib/supabase-admin";
import { siteUrl } from "@/lib/stripe-commerce";

export function createCoachInviteDeps(): CoachInviteDeps | null {
  const client = getServiceSupabase();
  if (!client) return null;

  return {
    siteUrl: siteUrl(),
    async findUserByEmail(email) {
      return findAuthUserByEmail(email);
    },
    async inviteUserByEmail(email, options) {
      const { data, error } = await client.auth.admin.inviteUserByEmail(email, {
        data: options.data,
        redirectTo: options.redirectTo || invitationRedirectUrl(siteUrl()),
      });
      if (error || !data.user) {
        return { user: null, error: error?.message || "Could not send the invitation." };
      }
      return { user: { id: data.user.id, email: data.user.email || email }, error: null };
    },
    async getEntitlement(userId) {
      return getEntitlementRecord(userId);
    },
    async grantPreview(userId) {
      await grantPreviewEntitlement(userId);
    },
    async grantComplimentary(userId) {
      await grantFullEntitlement(userId, "admin");
    },
    async upsertProfile(userId, email, name) {
      const now = new Date().toISOString();
      const { data: existing } = await client.from("profiles").select("id").eq("id", userId).maybeSingle();
      if (existing) {
        await client.from("profiles").update({ email, full_name: name, last_active: now.slice(0, 10) }).eq("id", userId);
        return;
      }
      await client.from("profiles").insert({
        id: userId,
        email,
        full_name: name,
        role: "student",
        cohort: DEFAULT_COHORT_ID,
      });
    },
    async updateWaitlist(leadId, patch) {
      const { error } = await client.from("waitlist").update(patch).eq("id", leadId);
      if (error && !/invitation_status|invited_at|invited_by|invited_user_id|invitation_access|schema cache|column/i.test(error.message)) {
        throw new Error(error.message);
      }
    },
    async logEvent(event) {
      const { error } = await client.from("course_admin_events").insert({
        actor_id: event.actor_id,
        action: event.action,
        target_email: event.target_email,
        target_user_id: event.target_user_id || null,
        waitlist_id: event.waitlist_id || null,
        payload: event.payload,
      });
      if (error && !/course_admin_events|schema cache|does not exist/i.test(error.message)) {
        console.error("[coach-invites] audit", error.message);
      }
    },
  };
}

export async function findAuthUserByEmail(email: string): Promise<FoundAuthUser | null> {
  const client = getServiceSupabase();
  if (!client) return null;
  const normalized = email.trim().toLowerCase();

  const { data: profile } = await client.from("profiles").select("id, email").eq("email", normalized).maybeSingle();
  if (profile?.id) {
    const { data } = await client.auth.admin.getUserById(profile.id);
    if (data.user?.email?.toLowerCase() === normalized) {
      return { id: data.user.id, email: data.user.email };
    }
  }

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    const found = (data.users || []).find((user) => user.email?.toLowerCase() === normalized);
    if (found) return { id: found.id, email: found.email || normalized };
    if ((data.users || []).length < 200) break;
  }
  return null;
}

export async function fetchWaitlistLeadsForInvite(): Promise<
  Array<{
    id: string;
    full_name: string;
    email: string;
    preferred_cohort: string;
    preferred_payment: string | null;
    institution: string | null;
    query: string | null;
    created_at: string;
    invitation_status: WaitlistInvitationStatus | null;
    invited_at: string | null;
    invitation_access: InviteAccess | null;
    invited_user_id: string | null;
  }>
> {
  const client = getServiceSupabase();
  if (!client) return [];
  const { data, error } = await client.from("waitlist").select("*").order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({
    id: String(row.id),
    full_name: String(row.full_name || ""),
    email: String(row.email || ""),
    preferred_cohort: String(row.preferred_cohort || ""),
    preferred_payment: row.preferred_payment == null ? null : String(row.preferred_payment),
    institution: row.institution == null ? null : String(row.institution),
    query: row.query == null ? null : String(row.query),
    created_at: String(row.created_at || ""),
    invitation_status:
      row.invitation_status === "invited" ||
      row.invitation_status === "existing_account" ||
      row.invitation_status === "granted" ||
      row.invitation_status === "waiting"
        ? row.invitation_status
        : null,
    invited_at: row.invited_at ? String(row.invited_at) : null,
    invitation_access:
      row.invitation_access === "free_preview" || row.invitation_access === "full_complimentary"
        ? row.invitation_access
        : null,
    invited_user_id: row.invited_user_id ? String(row.invited_user_id) : null,
  }));
}
