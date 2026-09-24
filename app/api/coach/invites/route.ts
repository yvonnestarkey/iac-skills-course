import { NextResponse } from "next/server";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import { createCoachInviteDeps, fetchWaitlistLeadsForInvite, findAuthUserByEmail } from "@/lib/coach-invites-admin";
import { processCoachInvite, type CoachInviteRequest, type InviteAccess } from "@/lib/coach-invites";
import { getEntitlementRecord } from "@/lib/commerce";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 403 });

  const leads = await fetchWaitlistLeadsForInvite();
  const enriched = await Promise.all(
    leads.map(async (lead) => {
      const existing = lead.invited_user_id
        ? { id: lead.invited_user_id, email: lead.email }
        : await findAuthUserByEmail(lead.email);
      const entitlement = existing ? await getEntitlementRecord(existing.id) : null;
      return {
        ...lead,
        account_exists: Boolean(existing),
        user_id: existing?.id || null,
        entitlement_status: entitlement?.status || null,
        entitlement_source: entitlement?.source || null,
        invitation_status:
          lead.invitation_status ||
          (existing ? (entitlement?.status ? "existing_account" : "existing_account") : "waiting"),
      };
    })
  );

  return NextResponse.json({ leads: enriched });
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as CoachInviteRequest | null;
  if (!body?.action) return NextResponse.json({ error: "Invitation action required." }, { status: 400 });

  const deps = createCoachInviteDeps();
  if (!deps) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });

  const leads = body.action === "invite_waitlist" ? await fetchWaitlistLeadsForInvite() : [];
  const result = await processCoachInvite(
    {
      action: body.action,
      confirm: Boolean(body.confirm),
      access: body.access as InviteAccess | undefined,
      lead_ids: body.lead_ids,
      name: body.name,
      email: body.email,
    },
    user,
    leads,
    deps
  );

  return NextResponse.json(result, { status: result.status });
}
