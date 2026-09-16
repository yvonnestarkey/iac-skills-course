import type { Cohort, Student } from "./types";

export const DEFAULT_COHORT_ID = "jan27";
export const JUNE_COHORT_ID = "jun27";

export const COURSE_COHORTS: Cohort[] = [
  { id: DEFAULT_COHORT_ID, name: "January 2027", starts: "Jan 2027", current: true },
  { id: JUNE_COHORT_ID, name: "June 2027", starts: "Jun 2027" },
];

export const CURRENT_COHORT_TERM = "January 2027 cohort";

const LEGACY_COHORT_IDS: Record<string, string> = {
  autumn26: DEFAULT_COHORT_ID,
  summer26: JUNE_COHORT_ID,
  "autumn 2026": DEFAULT_COHORT_ID,
  "summer 2026": JUNE_COHORT_ID,
  autumn: DEFAULT_COHORT_ID,
  summer: JUNE_COHORT_ID,
};

export function isKnownCohortId(id: string): boolean {
  return COURSE_COHORTS.some((cohort) => cohort.id === id);
}

export function normalizeCohortId(id?: string | null): string {
  const raw = (id || "").trim();
  if (!raw) return DEFAULT_COHORT_ID;
  if (isKnownCohortId(raw)) return raw;
  const mapped = LEGACY_COHORT_IDS[raw.toLowerCase()];
  if (mapped) return mapped;
  const byName = COURSE_COHORTS.find((cohort) => cohort.name.toLowerCase() === raw.toLowerCase());
  return byName?.id || raw;
}

export function displayCohortName(id?: string | null, fallback = "Unassigned"): string {
  const normalized = normalizeCohortId(id);
  return COURSE_COHORTS.find((cohort) => cohort.id === normalized)?.name || fallback;
}

function splitTagText(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[,;/\n]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1 && part.length < 80);
}

export function studentFilterTags(student: Student): { value: string; label: string }[] {
  const tags: { value: string; label: string }[] = [];
  const seen = new Set<string>();
  const add = (value: string, label: string) => {
    const key = value.toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    tags.push({ value: key, label });
  };

  splitTagText(student.struggleAreas).forEach((area) => add(`struggle:${area.toLowerCase()}`, area));
  if (student.country) add(`country:${student.country.toLowerCase()}`, student.country);
  if (student.ctaUniversity) add(`uni:${student.ctaUniversity.toLowerCase()}`, student.ctaUniversity);
  if (student.repeatStudent) add("repeat:true", "Repeat student");
  return tags;
}

export function uniqueStudentFilterTags(students: Student[]): { value: string; label: string }[] {
  const map = new Map<string, string>();
  students.forEach((student) => {
    studentFilterTags(student).forEach((tag) => {
      if (!map.has(tag.value)) map.set(tag.value, tag.label);
    });
  });
  return [...map.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function studentHasTag(student: Student, tag: string): boolean {
  if (!tag || tag === "all") return true;
  return studentFilterTags(student).some((item) => item.value === tag);
}
