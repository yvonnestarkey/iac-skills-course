export const ROSTER_COLUMNS = [
  { id: "name", label: "Student Name" },
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone Number" },
  { id: "accountabilityEmail", label: "Accountability Email" },
  { id: "cohort", label: "Cohort" },
  { id: "onboarding", label: "Onboarding Status" },
  { id: "progress", label: "Course Progress" },
  { id: "lastActive", label: "Last Active Date" },
  { id: "status", label: "Account Status" },
  { id: "submitted", label: "Submitted" },
  { id: "surveys", label: "Surveys" },
  { id: "waiting", label: "Waiting" },
] as const;

export type RosterColumnId = (typeof ROSTER_COLUMNS)[number]["id"];
export type RosterSortDir = "asc" | "desc";
export type OnboardingFilter = "completed" | "pending";
export type StatusFilter = "active" | "paused";

export const DEFAULT_ROSTER_COLUMNS: RosterColumnId[] = [
  "name",
  "email",
  "cohort",
  "progress",
  "submitted",
  "surveys",
  "waiting",
  "lastActive",
  "status",
];

export const PROGRESS_RANGES = [
  { id: "0-25", label: "0–25%", min: 0, max: 25 },
  { id: "26-50", label: "26–50%", min: 26, max: 50 },
  { id: "51-75", label: "51–75%", min: 51, max: 75 },
  { id: "76-100", label: "76–100%", min: 76, max: 100 },
] as const;

export type ProgressRangeId = (typeof PROGRESS_RANGES)[number]["id"];

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
