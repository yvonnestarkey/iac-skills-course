export const ROSTER_COLUMNS = [
  { id: "name", label: "Full Name" },
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone" },
  { id: "accountabilityEmail", label: "Accountability Email" },
  { id: "cohort", label: "Cohort ID" },
  { id: "onboarding", label: "Onboarding Completed" },
  { id: "country", label: "Country" },
  { id: "ctaUniversity", label: "CTA University" },
  { id: "ctaYear", label: "CTA Year" },
  { id: "iacAttempts", label: "IAC Attempts" },
  { id: "repeatStudent", label: "Repeat Student" },
  { id: "coachingGoals", label: "Coaching Goals" },
  { id: "struggleAreas", label: "Struggle Areas" },
  { id: "progress", label: "Course Progress" },
  { id: "lastActive", label: "Last Active Date" },
  { id: "status", label: "Account Status" },
  { id: "submitted", label: "Submitted" },
  { id: "surveys", label: "Surveys" },
  { id: "waiting", label: "Waiting" },
] as const;

export type RosterColumnId = (typeof ROSTER_COLUMNS)[number]["id"];
export type RosterSortDir = "asc" | "desc";

export const DEFAULT_ROSTER_COLUMNS: RosterColumnId[] = [
  "name",
  "email",
  "phone",
  "cohort",
  "onboarding",
  "country",
  "progress",
  "lastActive",
  "status",
];

export const ROSTER_FILTER_FIELDS = [
  { id: "name", label: "Full Name", kind: "text" },
  { id: "email", label: "Email", kind: "text" },
  { id: "phone", label: "Phone", kind: "text" },
  { id: "cohort", label: "Cohort ID", kind: "text" },
  { id: "onboardingCompleted", label: "Onboarding Completed", kind: "boolean" },
  { id: "country", label: "Country", kind: "text" },
  { id: "ctaYear", label: "CTA Year", kind: "text" },
  { id: "ctaUniversity", label: "CTA University", kind: "text" },
  { id: "iacAttempts", label: "IAC Attempts", kind: "text" },
  { id: "repeatStudent", label: "Repeat Student", kind: "boolean" },
  { id: "coachingGoals", label: "Coaching Goals", kind: "text" },
  { id: "struggleAreas", label: "Struggle Areas", kind: "text" },
] as const;

export type RosterFilterField = (typeof ROSTER_FILTER_FIELDS)[number]["id"];
export type RosterFilterOperator = "equals" | "contains" | "starts_with" | "is_empty" | "is_not_empty";
export type RosterFilterLogic = "and" | "or";

export const ROSTER_FILTER_OPERATORS: { id: RosterFilterOperator; label: string }[] = [
  { id: "equals", label: "equals" },
  { id: "contains", label: "contains" },
  { id: "starts_with", label: "starts with" },
  { id: "is_empty", label: "is empty" },
  { id: "is_not_empty", label: "is not empty" },
];

export interface RosterFilterRule {
  id: string;
  field: RosterFilterField;
  operator: RosterFilterOperator;
  value: string;
}

const COLUMN_IDS = new Set<string>(ROSTER_COLUMNS.map((column) => column.id));

export function rosterColumnLabel(id: RosterColumnId): string {
  return ROSTER_COLUMNS.find((column) => column.id === id)?.label || id;
}

export function sanitizeRosterColumns(ids: unknown): RosterColumnId[] {
  if (!Array.isArray(ids)) return [...DEFAULT_ROSTER_COLUMNS];
  const next = ids.filter((id): id is RosterColumnId => typeof id === "string" && COLUMN_IDS.has(id));
  return next.length ? next : [...DEFAULT_ROSTER_COLUMNS];
}

export function onboardingStatus(student: { onboardingCompleted?: boolean; onboardingSkipped?: boolean }): "completed" | "skipped" | "pending" {
  if (student.onboardingCompleted) return "completed";
  if (student.onboardingSkipped) return "skipped";
  return "pending";
}

export function onboardingStatusLabel(status: "completed" | "skipped" | "pending"): string {
  if (status === "completed") return "Completed";
  if (status === "skipped") return "Skipped";
  return "Pending";
}

export function newRosterFilterRule(): RosterFilterRule {
  return {
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    field: "name",
    operator: "contains",
    value: "",
  };
}

export function rosterFilterFieldKind(field: RosterFilterField): "text" | "boolean" {
  return ROSTER_FILTER_FIELDS.find((item) => item.id === field)?.kind || "text";
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

function pickText(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function pickBool(...values: unknown[]): boolean {
  for (const value of values) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      const text = value.trim().toLowerCase();
      if (["true", "t", "1", "yes"].includes(text)) return true;
      if (["false", "f", "0", "no"].includes(text)) return false;
    }
  }
  return false;
}

export interface RosterOnboardingFields {
  country: string | null;
  ctaUniversity: string | null;
  ctaYear: string | null;
  iacAttempts: string | null;
  repeatStudent: boolean;
  coachingGoals: string | null;
  struggleAreas: string | null;
  onboardingCompleted: boolean;
  onboardingSkipped: boolean;
}

export function parseRosterOnboarding(row: Record<string, unknown>): RosterOnboardingFields {
  const demo = asObject(row.demographics);
  const notes = asObject(row.qualitative_notes);
  return {
    country: pickText(row.country, demo.country),
    ctaUniversity: pickText(row.cta_university, row.cta_institution, demo.cta_institution, demo.cta_university),
    ctaYear: pickText(row.cta_year, row.cta_year_passed, demo.cta_year, demo.cta_year_passed),
    iacAttempts: pickText(row.iac_attempts, row.exam_attempts, demo.exam_attempts, demo.iac_attempt_count),
    repeatStudent: pickBool(
      row.repeat_student,
      demo.written_before,
      demo.iac_written_exam_before,
      row.written_before
    ),
    coachingGoals: pickText(row.coaching_goals, notes.coaching_goals, notes.coaching_hopes),
    struggleAreas: pickText(row.struggle_areas, notes.struggle_areas, notes.struggling_areas),
    onboardingCompleted: pickBool(row.onboarding_completed),
    onboardingSkipped: pickBool(row.onboarding_skipped),
  };
}

export function rosterRuleValue(student: {
  name: string;
  email: string;
  phone?: string | null;
  cohort: string;
  onboardingCompleted?: boolean;
  country?: string | null;
  ctaYear?: string | null;
  ctaUniversity?: string | null;
  iacAttempts?: string | null;
  repeatStudent?: boolean;
  coachingGoals?: string | null;
  struggleAreas?: string | null;
}, field: RosterFilterField): string {
  switch (field) {
    case "name":
      return student.name || "";
    case "email":
      return student.email || "";
    case "phone":
      return student.phone || "";
    case "cohort":
      return student.cohort || "";
    case "onboardingCompleted":
      return student.onboardingCompleted ? "true" : "false";
    case "country":
      return student.country || "";
    case "ctaYear":
      return student.ctaYear || "";
    case "ctaUniversity":
      return student.ctaUniversity || "";
    case "iacAttempts":
      return student.iacAttempts || "";
    case "repeatStudent":
      return student.repeatStudent ? "true" : "false";
    case "coachingGoals":
      return student.coachingGoals || "";
    case "struggleAreas":
      return student.struggleAreas || "";
    default:
      return "";
  }
}

export function matchRosterRule(
  student: Parameters<typeof rosterRuleValue>[0],
  rule: RosterFilterRule
): boolean {
  const raw = rosterRuleValue(student, rule.field).trim();
  const empty = !raw;
  if (rule.operator === "is_empty") return empty;
  if (rule.operator === "is_not_empty") return !empty;
  const needle = rule.value.trim();
  if (!needle) return true;
  const hay = raw.toLowerCase();
  const query = needle.toLowerCase();
  if (rule.operator === "equals") return hay === query;
  if (rule.operator === "contains") return hay.includes(query);
  if (rule.operator === "starts_with") return hay.startsWith(query);
  return true;
}

export function matchRosterRules(
  student: Parameters<typeof rosterRuleValue>[0],
  rules: RosterFilterRule[],
  logic: RosterFilterLogic
): boolean {
  const active = rules.filter((rule) => rule.operator === "is_empty" || rule.operator === "is_not_empty" || rule.value.trim());
  if (!active.length) return true;
  if (logic === "or") return active.some((rule) => matchRosterRule(student, rule));
  return active.every((rule) => matchRosterRule(student, rule));
}

export function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function downloadRosterCsv(filename: string, headers: string[], lines: string[][]): void {
  const body = [headers.map(csvEscape).join(","), ...lines.map((line) => line.map(csvEscape).join(","))].join("\r\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
