export const ROSTER_COLUMNS = [
  { id: "name", label: "Full Name" },
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone Number" },
  { id: "accountabilityEmail", label: "Accountability Email" },
  { id: "cohort", label: "Cohort" },
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
  { id: "phone", label: "Phone Number", kind: "text" },
  { id: "accountabilityEmail", label: "Accountability Email", kind: "text" },
  { id: "cohort", label: "Cohort", kind: "categorical" },
  { id: "onboardingCompleted", label: "Onboarding Completed", kind: "boolean" },
  { id: "country", label: "Country", kind: "categorical" },
  { id: "ctaUniversity", label: "CTA University", kind: "categorical" },
  { id: "ctaYear", label: "CTA Year", kind: "categorical" },
  { id: "iacAttempts", label: "IAC Attempts", kind: "categorical" },
  { id: "repeatStudent", label: "Repeat Student", kind: "boolean" },
  { id: "coachingGoals", label: "Coaching Goals", kind: "text" },
  { id: "struggleAreas", label: "Struggle Areas", kind: "text" },
] as const;

export type RosterFilterField = (typeof ROSTER_FILTER_FIELDS)[number]["id"];
export type RosterFilterKind = (typeof ROSTER_FILTER_FIELDS)[number]["kind"];
export type RosterFilterOperator =
  | "contains"
  | "equals"
  | "starts_with"
  | "is_empty"
  | "is_not_empty"
  | "is";
export type RosterFilterLogic = "and" | "or";

export interface RosterFilterOption {
  value: string;
  label: string;
}

export const ROSTER_TEXT_OPERATORS: { id: RosterFilterOperator; label: string }[] = [
  { id: "contains", label: "contains" },
  { id: "equals", label: "equals" },
  { id: "starts_with", label: "starts with" },
  { id: "is_empty", label: "is empty" },
  { id: "is_not_empty", label: "is not empty" },
];

export const ROSTER_CATEGORY_OPERATORS: { id: RosterFilterOperator; label: string }[] = [
  { id: "is", label: "is" },
  { id: "is_empty", label: "is empty" },
  { id: "is_not_empty", label: "is not empty" },
];

export const ROSTER_BOOLEAN_OPERATORS: { id: RosterFilterOperator; label: string }[] = [{ id: "is", label: "is" }];

export interface RosterFilterRule {
  id: string;
  field: RosterFilterField;
  operator: RosterFilterOperator;
  values: string[];
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
    values: [],
  };
}

export function rosterFilterFieldKind(field: RosterFilterField): RosterFilterKind {
  return ROSTER_FILTER_FIELDS.find((item) => item.id === field)?.kind || "text";
}

export function defaultOperatorForField(field: RosterFilterField): RosterFilterOperator {
  const kind = rosterFilterFieldKind(field);
  if (kind === "boolean") return "is";
  if (kind === "categorical") return "is";
  return "contains";
}

export function operatorsForField(field: RosterFilterField): { id: RosterFilterOperator; label: string }[] {
  const kind = rosterFilterFieldKind(field);
  if (kind === "boolean") return ROSTER_BOOLEAN_OPERATORS;
  if (kind === "categorical") return ROSTER_CATEGORY_OPERATORS;
  return ROSTER_TEXT_OPERATORS;
}

export const ROSTER_COUNTRY_OPTIONS = [
  "South Africa",
  "Zimbabwe",
  "Namibia",
  "Botswana",
  "Eswatini",
  "Other",
] as const;

export const ROSTER_CTA_UNIVERSITY_OPTIONS = [
  "UCT",
  "Wits",
  "Stellenbosch",
  "UP",
  "UJ",
  "UKZN",
  "NWU",
  "UFS",
  "Unisa",
  "Other",
] as const;

export const ROSTER_IAC_ATTEMPTS_OPTIONS = ["0", "1", "2", "3+"] as const;

export const ROSTER_CTA_YEAR_OPTIONS = ["2026", "2025", "2024", "2023", "2022"] as const;

export const ROSTER_FILTER_DEFAULTS: Partial<Record<RosterFilterField, readonly string[]>> = {
  country: ROSTER_COUNTRY_OPTIONS,
  ctaUniversity: ROSTER_CTA_UNIVERSITY_OPTIONS,
  iacAttempts: ROSTER_IAC_ATTEMPTS_OPTIONS,
  ctaYear: ROSTER_CTA_YEAR_OPTIONS,
};

export function cleanRosterOptionValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  const lower = text.toLowerCase();
  if (lower === "null" || lower === "undefined") return null;
  return text;
}

function optionKey(value: string): string {
  return value.toLowerCase();
}

export function uniqueRosterOptions(
  students: Array<Parameters<typeof rosterRuleValue>[0]>,
  field: RosterFilterField,
  labelFor?: (value: string) => string,
  defaults?: RosterFilterOption[]
): RosterFilterOption[] {
  const seen = new Map<string, RosterFilterOption>();
  const extras: RosterFilterOption[] = [];

  const add = (raw: unknown, label?: string, intoExtras = false) => {
    const value = cleanRosterOptionValue(raw);
    if (!value) return;
    const key = optionKey(value);
    if (seen.has(key)) return;
    const option = { value, label: cleanRosterOptionValue(label) || labelFor?.(value) || value };
    seen.set(key, option);
    if (intoExtras) extras.push(option);
  };

  (defaults || []).forEach((item) => add(item.value, item.label));
  (ROSTER_FILTER_DEFAULTS[field] || []).forEach((item) => add(item));
  students.forEach((student) => add(rosterRuleValue(student, field), undefined, true));

  extras.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" }));
  const base = Array.from(seen.values()).filter((option) => extras.every((extra) => optionKey(extra.value) !== optionKey(option.value)));
  const otherIndex = base.findIndex((option) => optionKey(option.value) === "other");
  if (otherIndex >= 0) {
    return [...base.slice(0, otherIndex), ...extras, base[otherIndex]];
  }
  return [...base, ...extras];
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
  accountabilityEmail?: string | null;
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
    case "accountabilityEmail":
      return student.accountabilityEmail || "";
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
  const selected = (rule.values || []).map((value) => value.trim()).filter(Boolean);
  if (!selected.length) return true;
  const hay = raw.toLowerCase();
  if (rule.operator === "contains") return hay.includes(selected[0].toLowerCase());
  if (rule.operator === "starts_with") return hay.startsWith(selected[0].toLowerCase());
  if (rule.operator === "equals" || rule.operator === "is") return hay === selected[0].toLowerCase();
  return true;
}

export function matchRosterRules(
  student: Parameters<typeof rosterRuleValue>[0],
  rules: RosterFilterRule[],
  logic: RosterFilterLogic
): boolean {
  const active = rules.filter((rule) => {
    if (rule.operator === "is_empty" || rule.operator === "is_not_empty") return true;
    return (rule.values || []).some((value) => value.trim());
  });
  if (!active.length) return true;
  const matches = active.map((rule) => matchRosterRule(student, rule));
  return logic === "or" ? matches.some(Boolean) : matches.every(Boolean);
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
