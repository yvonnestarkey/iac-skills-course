import { asProfileText, editablePersonName, isLikelyEmail, joinPersonName } from "./account-profile";
import { ONBOARDING_COUNTRIES, ONBOARDING_CTA_YEARS, ONBOARDING_INSTITUTIONS } from "./onboarding";
import {
  onboardingStatus,
  onboardingStatusLabel,
  ROSTER_COUNTRY_OPTIONS,
  ROSTER_CTA_UNIVERSITY_OPTIONS,
  ROSTER_CTA_YEAR_OPTIONS,
} from "./roster";
import type { Student } from "./types";

export type CoachStudentProfileForm = {
  firstName: string;
  lastName: string;
  phone: string;
  accountabilityEmail: string;
  writtenExam: "yes" | "no" | "";
  iacAttempts: string;
  country: string;
  institution: string;
  institutionOther: string;
  yearPassed: string;
  ctaAttempts: string;
  struggleAreas: string;
  coachingGoals: string;
  additionalNotes: string;
};

export type CoachStudentProfilePatch = {
  name?: string;
  phone: string | null;
  accountabilityEmail: string | null;
  country: string | null;
  ctaUniversity: string | null;
  ctaYear: string | null;
  ctaAttempts: string | null;
  iacAttempts: string | null;
  repeatStudent: boolean;
  coachingGoals: string | null;
  struggleAreas: string | null;
  additionalNotes: string | null;
  onboardingCompleted: boolean;
  onboardingSkipped: boolean;
};

function uniqueOptions(...groups: readonly (readonly string[] | string[])[]): string[] {
  const seen = new Set<string>();
  const options: string[] = [];
  groups.flat().forEach((value) => {
    const text = asProfileText(value);
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    options.push(text);
  });
  return options;
}

export const COACH_PROFILE_COUNTRIES = uniqueOptions(ONBOARDING_COUNTRIES, ROSTER_COUNTRY_OPTIONS);
export const COACH_PROFILE_INSTITUTIONS = uniqueOptions(ONBOARDING_INSTITUTIONS, ROSTER_CTA_UNIVERSITY_OPTIONS);
export const COACH_PROFILE_YEARS = uniqueOptions(
  ONBOARDING_CTA_YEARS.map(String),
  ROSTER_CTA_YEAR_OPTIONS
);
export const COACH_PROFILE_IAC_ATTEMPTS = ["0", "1", "2", "3", "4", "5", "6", "3+"];
export const COACH_PROFILE_CTA_ATTEMPTS = ["1", "2", "3", "4", "5"];

function inList(value: string, options: readonly string[]): boolean {
  const key = value.toLowerCase();
  return options.some((option) => option.toLowerCase() === key);
}

export function coachStudentProfileForm(student: Student): CoachStudentProfileForm {
  const names = editablePersonName(student.name, student.email);
  const university = asProfileText(student.ctaUniversity);
  const knownInstitution = university && inList(university, COACH_PROFILE_INSTITUTIONS);
  const written = student.repeatStudent || asProfileText(student.iacAttempts)
    ? "yes"
    : student.onboardingCompleted
      ? "no"
      : "";
  return {
    firstName: names.firstName,
    lastName: names.lastName,
    phone: asProfileText(student.phone),
    accountabilityEmail: asProfileText(student.accountabilityEmail),
    writtenExam: written,
    iacAttempts: asProfileText(student.iacAttempts),
    country: asProfileText(student.country),
    institution: knownInstitution ? university : university ? "Other" : "",
    institutionOther: knownInstitution ? "" : university,
    yearPassed: asProfileText(student.ctaYear),
    ctaAttempts: asProfileText(student.ctaAttempts),
    struggleAreas: asProfileText(student.struggleAreas),
    coachingGoals: asProfileText(student.coachingGoals),
    additionalNotes: asProfileText(student.additionalNotes),
  };
}

function textOrNull(value: string): string | null {
  const text = asProfileText(value);
  return text || null;
}

export function coachProfileInstitution(form: CoachStudentProfileForm): string | null {
  if (form.institution === "Other") return textOrNull(form.institutionOther);
  return textOrNull(form.institution);
}

export function coachOnboardingHasContent(form: CoachStudentProfileForm): boolean {
  return Boolean(
    form.writtenExam ||
      textOrNull(form.iacAttempts) ||
      textOrNull(form.country) ||
      coachProfileInstitution(form) ||
      textOrNull(form.yearPassed) ||
      textOrNull(form.ctaAttempts) ||
      textOrNull(form.struggleAreas) ||
      textOrNull(form.coachingGoals) ||
      textOrNull(form.additionalNotes) ||
      textOrNull(form.phone) ||
      textOrNull(form.accountabilityEmail)
  );
}

export function validateCoachStudentProfile(form: CoachStudentProfileForm): string | null {
  const email = asProfileText(form.accountabilityEmail);
  if (email && !isLikelyEmail(email)) return "Enter a valid accountability email, or leave it blank.";
  return null;
}

export function withCurrentOption(options: readonly string[], current: string): string[] {
  const text = asProfileText(current);
  if (!text || inList(text, options)) return [...options];
  return [...options, text];
}

export function coachStudentProfileSummary(student: Student, form: CoachStudentProfileForm): string {
  const name = joinPersonName(form.firstName, form.lastName) || "Name not set";
  return `${name} · ${onboardingStatusLabel(onboardingStatus(student))}`;
}

export function studentPatchFromCoachForm(
  student: Student,
  form: CoachStudentProfileForm
): CoachStudentProfilePatch {
  const name = joinPersonName(form.firstName, form.lastName);
  const hasOnboarding = student.onboardingCompleted === true || coachOnboardingHasContent(form);
  return {
    ...(name ? { name } : {}),
    phone: textOrNull(form.phone),
    accountabilityEmail: textOrNull(form.accountabilityEmail)?.toLowerCase() || null,
    country: textOrNull(form.country),
    ctaUniversity: coachProfileInstitution(form),
    ctaYear: textOrNull(form.yearPassed),
    ctaAttempts: textOrNull(form.ctaAttempts),
    iacAttempts: form.writtenExam === "no" ? null : textOrNull(form.iacAttempts),
    repeatStudent: form.writtenExam === "yes",
    coachingGoals: textOrNull(form.coachingGoals),
    struggleAreas: textOrNull(form.struggleAreas),
    additionalNotes: textOrNull(form.additionalNotes),
    onboardingCompleted: hasOnboarding,
    onboardingSkipped: hasOnboarding ? false : student.onboardingSkipped === true,
  };
}

export function onboardingRowFromCoachForm(form: CoachStudentProfileForm, complete: boolean) {
  const attempts = form.writtenExam === "no" ? null : textOrNull(form.iacAttempts);
  const year = textOrNull(form.yearPassed);
  const ctaAttempts = textOrNull(form.ctaAttempts);
  return {
    demographics: {
      written_before: form.writtenExam === "yes",
      exam_attempts: attempts && /^\d+$/.test(attempts) ? Number(attempts) : attempts,
      country: textOrNull(form.country),
      cta_institution: coachProfileInstitution(form),
      cta_year: year && /^\d+$/.test(year) ? Number(year) : year,
      cta_attempts: ctaAttempts && /^\d+$/.test(ctaAttempts) ? Number(ctaAttempts) : ctaAttempts,
    },
    qualitative_notes: {
      struggle_areas: asProfileText(form.struggleAreas),
      coaching_goals: asProfileText(form.coachingGoals),
      additional_notes: asProfileText(form.additionalNotes),
    },
    onboarding_completed: complete,
    ...(complete ? { onboarding_skipped: false } : {}),
  };
}
