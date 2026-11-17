import { NextResponse } from "next/server";
import { asProfileText } from "@/lib/account-profile";
import { validateCoachStudentProfile, type CoachStudentProfileForm } from "@/lib/coach-student-profile";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import { updateCoachStudentProfile } from "@/lib/student-profile-admin";

export const dynamic = "force-dynamic";

function asWritten(value: unknown): "yes" | "no" | "" {
  return value === "yes" || value === "no" ? value : "";
}

function formFromBody(body: Record<string, unknown> | null): CoachStudentProfileForm {
  return {
    firstName: asProfileText(body?.first_name),
    lastName: asProfileText(body?.last_name),
    phone: asProfileText(body?.phone),
    accountabilityEmail: asProfileText(body?.accountability_email),
    writtenExam: asWritten(body?.written_exam),
    iacAttempts: asProfileText(body?.iac_attempts),
    country: asProfileText(body?.country),
    institution: asProfileText(body?.institution),
    institutionOther: asProfileText(body?.institution_other),
    yearPassed: asProfileText(body?.year_passed),
    ctaAttempts: asProfileText(body?.cta_attempts),
    struggleAreas: asProfileText(body?.struggle_areas),
    coachingGoals: asProfileText(body?.coaching_goals),
    additionalNotes: asProfileText(body?.additional_notes),
  };
}

export async function PATCH(request: Request) {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const studentId = asProfileText(body?.student_id);
  if (!studentId) return NextResponse.json({ error: "Student required." }, { status: 400 });

  const form = formFromBody(body);
  const invalid = validateCoachStudentProfile(form);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const result = await updateCoachStudentProfile(studentId, form, {
    onboardingCompleted: body?.onboarding_completed === true,
    onboardingSkipped: body?.onboarding_skipped === true,
    email: asProfileText(body?.email) || null,
  });
  if (result.ok === false) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ ok: true, patch: result.patch, name: result.patch.name || null });
}
