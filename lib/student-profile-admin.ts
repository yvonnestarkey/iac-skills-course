import { asProfileText, joinPersonName } from "./account-profile";
import {
  coachOnboardingHasContent,
  onboardingRowFromCoachForm,
  studentPatchFromCoachForm,
  type CoachStudentProfileForm,
  type CoachStudentProfilePatch,
} from "./coach-student-profile";
import { inviteUserMetadata } from "./invite-email";
import { getServiceSupabase } from "./supabase-admin";

export async function updateCoachStudentProfile(
  studentId: string,
  form: CoachStudentProfileForm,
  current: { onboardingCompleted?: boolean; onboardingSkipped?: boolean; email?: string | null }
): Promise<{ ok: true; patch: CoachStudentProfilePatch } | { ok: false; error: string }> {
  const client = getServiceSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };

  const existing = await client.auth.admin.getUserById(studentId);
  if (existing.error || !existing.data.user) return { ok: false, error: "That student was not found." };

  const now = new Date().toISOString();
  const fullName = joinPersonName(form.firstName, form.lastName);
  const email = asProfileText(existing.data.user.email) || asProfileText(current.email);
  const patch = studentPatchFromCoachForm(
    {
      id: studentId,
      name: fullName,
      email,
      cohort: "",
      status: "active",
      onboardingCompleted: current.onboardingCompleted,
      onboardingSkipped: current.onboardingSkipped,
    },
    form
  );

  const profileRow: Record<string, unknown> = {
    id: studentId,
    email: email || existing.data.user.email || "",
    phone_number: patch.phone,
    accountability_email: patch.accountabilityEmail,
    updated_at: now,
  };
  if (fullName) profileRow.full_name = fullName;

  let write = await client.from("profiles").upsert(profileRow, { onConflict: "id" });
  if (write.error && /updated_at|could not find|schema cache/i.test(write.error.message)) {
    const { updated_at: _updated, ...withoutStamp } = profileRow;
    write = await client.from("profiles").upsert(withoutStamp, { onConflict: "id" });
  }
  if (write.error) return { ok: false, error: write.error.message };

  if (fullName) {
    const { error } = await client.auth.admin.updateUserById(studentId, {
      user_metadata: {
        ...(existing.data.user.user_metadata || {}),
        ...inviteUserMetadata(fullName),
      },
    });
    if (error) return { ok: false, error: error.message };
  }

  const shouldWriteOnboarding = current.onboardingCompleted === true || coachOnboardingHasContent(form);
  if (shouldWriteOnboarding) {
    const row = {
      student_id: studentId,
      ...onboardingRowFromCoachForm(form, true),
      updated_at: now,
    };
    const { error } = await client.from("student_profiles").upsert(row, { onConflict: "student_id" });
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true, patch };
}
