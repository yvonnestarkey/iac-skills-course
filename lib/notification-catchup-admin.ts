import { DEFAULT_COHORT_ID, normalizeCohortId } from "./cohorts";
import { missedCohortAnnouncements, type CatchupRow } from "./notification-catchup";
import { getServiceSupabase } from "./supabase-admin";

function asText(value: unknown): string {
  return String(value || "").trim();
}

function asCatchupRow(row: Record<string, unknown>, cohortByUser: Map<string, string>): CatchupRow | null {
  const userId = asText(row.user_id || row.student_id);
  if (!userId) return null;
  return {
    userId,
    cohort: cohortByUser.get(userId) || asText(row.cohort) || DEFAULT_COHORT_ID,
    kind: asText(row.kind || row.type) || "announcement",
    audience: asText(row.audience) || null,
    title: asText(row.title),
    message: asText(row.message || row.body),
    createdAt: asText(row.created_at),
  };
}

export async function claimMissedCohortAnnouncements(input: {
  studentId: string;
  email?: string | null;
}): Promise<{ ok: boolean; inserted: number; error?: string }> {
  const client = getServiceSupabase();
  if (!client) return { ok: false, inserted: 0, error: "Supabase is not configured." };

  const profile = await client.from("profiles").select("id, email, cohort").eq("id", input.studentId).maybeSingle();
  if (profile.error) return { ok: false, inserted: 0, error: profile.error.message };
  if (!profile.data) return { ok: true, inserted: 0 };

  const cohort = normalizeCohortId(asText(profile.data.cohort) || DEFAULT_COHORT_ID);
  const email = asText(input.email || profile.data.email);

  let query = await client
    .from("notifications")
    .select("user_id, student_id, kind, type, title, message, body, created_at, audience, cohort");
  if (query.error && /audience|cohort|schema cache|column/i.test(query.error.message)) {
    query = await client
      .from("notifications")
      .select("user_id, student_id, kind, type, title, message, body, created_at");
  }
  if (query.error) return { ok: false, inserted: 0, error: query.error.message };

  const userIds = [
    ...new Set(
      (query.data || [])
        .map((row) => asText((row as { user_id?: string; student_id?: string }).user_id || (row as { student_id?: string }).student_id))
        .filter(Boolean)
    ),
  ];
  const cohortByUser = new Map<string, string>();
  if (userIds.length) {
    const profiles = await client.from("profiles").select("id, cohort").in("id", userIds);
    (profiles.data || []).forEach((row) => {
      cohortByUser.set(String(row.id), normalizeCohortId(asText(row.cohort) || DEFAULT_COHORT_ID));
    });
  }

  const rows = (query.data || [])
    .map((row) => asCatchupRow(row as Record<string, unknown>, cohortByUser))
    .filter((row): row is CatchupRow => Boolean(row));
  const own = rows.filter((row) => row.userId === input.studentId);
  const others = rows.filter((row) => row.userId !== input.studentId);
  const missed = missedCohortAnnouncements({ studentId: input.studentId, cohort, own, others });
  if (!missed.length) return { ok: true, inserted: 0 };

  const payload = missed.map((item) => ({
    user_id: input.studentId,
    student_id: input.studentId,
    student_email: email,
    from_role: "coach",
    kind: "announcement",
    type: "announcement",
    title: item.title,
    message: item.message,
    body: item.message,
    read: false,
    created_at: item.createdAt || new Date().toISOString(),
    audience: "cohort",
    cohort,
  }));

  const first = await client.from("notifications").insert(payload).select("id");
  if (!first.error) return { ok: true, inserted: first.data?.length || payload.length };

  const fallback = await client
    .from("notifications")
    .insert(
      payload.map((row) => ({
        user_id: row.user_id,
        student_id: row.student_id,
        student_email: row.student_email,
        from_role: row.from_role,
        kind: row.kind,
        body: row.body,
        title: row.title,
        message: row.message,
        read: false,
        created_at: row.created_at,
      }))
    )
    .select("id");
  if (!fallback.error) return { ok: true, inserted: fallback.data?.length || payload.length };

  const withoutStamp = await client
    .from("notifications")
    .insert(
      payload.map((row) => ({
        user_id: row.user_id,
        student_id: row.student_id,
        student_email: row.student_email,
        from_role: row.from_role,
        kind: row.kind,
        body: row.body,
      }))
    )
    .select("id");
  if (!withoutStamp.error) return { ok: true, inserted: withoutStamp.data?.length || payload.length };

  return { ok: false, inserted: 0, error: withoutStamp.error.message || first.error.message };
}
