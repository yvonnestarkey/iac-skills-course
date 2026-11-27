import { attemptHasAnyUploadedFile, examAttemptFromRow, isAttemptSubmitted } from "./exam-attempts";
import { STAFF_TEST_ATTEMPT_SOURCE } from "./staff-access";
import { JOURNAL_NEEDS, journalWeekFilled, journalWeekStart, weekFromRow } from "./study-journal";
import { portalToday } from "./student-task-due-dates";
import { asProfileText } from "./account-profile";
import type { OutlineChapter } from "./student-lesson";
import { getSupabase } from "./supabase";
import { getServiceSupabase } from "./supabase-admin";

export const STUDENT_POPUPS_SQL_HINT =
  "Paste supabase/student-popups.sql in the Supabase SQL editor, then try again.";

export const POPUP_BG = "/student-popup-bg.jpg";

export const POPUP_ACTIVITY_TYPES = [
  { id: "script_eval", label: "Submit your script evaluation", href: "/student/evaluator" },
  { id: "study_plan", label: "Set up your study planner", href: "/student/planner" },
  { id: "study_journal", label: "Fill this week's study journal", href: "/student/journal" },
  { id: "coaching_book", label: "Book 1-on-1 coaching", href: "/student/coaching" },
  { id: "lesson", label: "Complete a lesson", href: "" },
] as const;

export type PopupActivityType = (typeof POPUP_ACTIVITY_TYPES)[number]["id"];
export type PopupItemKind = "activity" | "commitment" | "question";
export type PopupFilterLogic = "and" | "or";
export type PopupFilterField =
  | "courseAccess"
  | "onboarding"
  | "hasStudyPlan"
  | "journalThisWeek"
  | "journalNeed"
  | "scriptEval"
  | "coaching"
  | "lessonComplete";

export type PopupFilterRule = {
  id: string;
  field: PopupFilterField;
  operator: "is" | "is_not";
  value: string;
};

export type PopupActivityItem = {
  id: string;
  kind: "activity";
  activity: PopupActivityType;
  label: string;
  lessonId?: string;
};

export type PopupCommitmentItem = {
  id: string;
  kind: "commitment";
  label: string;
  deadline?: string;
  activity?: PopupActivityType | "";
  lessonId?: string;
};

export type PopupQuestionItem = {
  id: string;
  kind: "question";
  label: string;
};

export type PopupItem = PopupActivityItem | PopupCommitmentItem | PopupQuestionItem;

export type PopupResponse = {
  itemId: string;
  kind: "commitment" | "answer";
  accepted: boolean;
  answer: string;
  updatedAt: string;
};

export type PopupDismissal = {
  popupId: string;
  mode: "forever" | "today";
  onDate: string;
};

export type PopupContext = {
  courseAccess: "full" | "free_preview";
  onboarding: "completed" | "skipped" | "pending";
  hasStudyPlan: boolean;
  journalThisWeek: boolean;
  journalNeed: string;
  scriptEval: "not_started" | "uploaded" | "submitted";
  coaching: "none" | "booked" | "completed";
  completedLessonIds: string[];
};

export type PopupFollowThrough = "followed_through" | "open" | "missed";

export const POPUP_FILTER_FIELDS: { id: PopupFilterField; label: string }[] = [
  { id: "courseAccess", label: "Course access" },
  { id: "onboarding", label: "Onboarding" },
  { id: "hasStudyPlan", label: "Study planner" },
  { id: "journalThisWeek", label: "Study journal this week" },
  { id: "journalNeed", label: "Journal need" },
  { id: "scriptEval", label: "Script evaluation" },
  { id: "coaching", label: "1-on-1 coaching" },
  { id: "lessonComplete", label: "Lesson completed" },
];

export function popupFilterOptions(field: PopupFilterField, lessons: { id: string; title: string }[] = []): { value: string; label: string }[] {
  if (field === "courseAccess") return [
    { value: "full", label: "Full course" },
    { value: "free_preview", label: "Free preview" },
  ];
  if (field === "onboarding") return [
    { value: "completed", label: "Completed" },
    { value: "skipped", label: "Skipped" },
    { value: "pending", label: "Pending" },
  ];
  if (field === "hasStudyPlan" || field === "journalThisWeek" || field === "lessonComplete") {
    const yesNo = [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ];
    if (field !== "lessonComplete") return yesNo;
    return lessons.map((lesson) => ({ value: lesson.id, label: lesson.title }));
  }
  if (field === "journalNeed") return JOURNAL_NEEDS.map((need) => ({ value: need.id, label: need.label }));
  if (field === "scriptEval") return [
    { value: "not_started", label: "Not started" },
    { value: "uploaded", label: "Uploaded, not submitted" },
    { value: "submitted", label: "Submitted" },
  ];
  return [
    { value: "none", label: "Not booked" },
    { value: "booked", label: "Booked" },
    { value: "completed", label: "Session completed" },
  ];
}

export function newPopupItemId(): string {
  return `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function emptyPopupFilter(): PopupFilterRule {
  return { id: newPopupItemId(), field: "scriptEval", operator: "is", value: "not_started" };
}

export function emptyPopupActivity(): PopupActivityItem {
  return { id: newPopupItemId(), kind: "activity", activity: "script_eval", label: "Submit your script evaluation" };
}

export function emptyPopupCommitment(): PopupCommitmentItem {
  return { id: newPopupItemId(), kind: "commitment", label: "I will keep to this plan.", deadline: "", activity: "" };
}

export function emptyPopupQuestion(): PopupQuestionItem {
  return { id: newPopupItemId(), kind: "question", label: "What is getting in the way this week?" };
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function parsePopupFilters(value: unknown): PopupFilterRule[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      const item = asObject(row);
      const field = String(item.field || "") as PopupFilterField;
      if (!POPUP_FILTER_FIELDS.some((option) => option.id === field)) return null;
      return {
        id: asProfileText(item.id) || newPopupItemId(),
        field,
        operator: item.operator === "is_not" ? "is_not" : "is",
        value: asProfileText(item.value),
      } satisfies PopupFilterRule;
    })
    .filter((row): row is PopupFilterRule => Boolean(row));
}

export function parsePopupItems(value: unknown): PopupItem[] {
  if (!Array.isArray(value)) return [];
  const items: PopupItem[] = [];
  value.forEach((row) => {
    const item = asObject(row);
    const id = asProfileText(item.id) || newPopupItemId();
    const label = asProfileText(item.label);
    const kind = String(item.kind || "");
    const lessonId = asProfileText(item.lessonId || item.lesson_id) || undefined;
    if (kind === "commitment") {
      const activity = String(item.activity || "") as PopupActivityType | "";
      items.push({
        id,
        kind: "commitment",
        label: label || "I agree to this.",
        deadline: asProfileText(item.deadline) || undefined,
        activity: POPUP_ACTIVITY_TYPES.some((option) => option.id === activity) ? activity : "",
        lessonId,
      });
      return;
    }
    if (kind === "question") {
      items.push({ id, kind: "question", label: label || "Your answer" });
      return;
    }
    const activity = String(item.activity || "script_eval") as PopupActivityType;
    const known = POPUP_ACTIVITY_TYPES.find((option) => option.id === activity) || POPUP_ACTIVITY_TYPES[0];
    items.push({
      id,
      kind: "activity",
      activity: known.id,
      label: label || known.label,
      lessonId,
    });
  });
  return items;
}

export function parsePopupFilterLogic(value: unknown): PopupFilterLogic {
  return value === "or" ? "or" : "and";
}

export function popupActivityHref(item: { activity?: string; lessonId?: string; href?: string }): string {
  if (item.activity === "lesson" && item.lessonId) return `/student/${item.lessonId}`;
  return POPUP_ACTIVITY_TYPES.find((option) => option.id === item.activity)?.href || asProfileText(item.href);
}

export function activityIsDone(activity: PopupActivityType, ctx: PopupContext, lessonId = ""): boolean {
  if (activity === "script_eval") return ctx.scriptEval === "submitted";
  if (activity === "study_plan") return ctx.hasStudyPlan;
  if (activity === "study_journal") return ctx.journalThisWeek;
  if (activity === "coaching_book") return ctx.coaching !== "none";
  if (activity === "lesson") return Boolean(lessonId) && ctx.completedLessonIds.includes(lessonId);
  return false;
}

function fieldMatches(rule: PopupFilterRule, ctx: PopupContext): boolean {
  let actual = "";
  if (rule.field === "courseAccess") actual = ctx.courseAccess;
  else if (rule.field === "onboarding") actual = ctx.onboarding;
  else if (rule.field === "hasStudyPlan") actual = ctx.hasStudyPlan ? "yes" : "no";
  else if (rule.field === "journalThisWeek") actual = ctx.journalThisWeek ? "yes" : "no";
  else if (rule.field === "journalNeed") actual = ctx.journalNeed;
  else if (rule.field === "scriptEval") actual = ctx.scriptEval;
  else if (rule.field === "coaching") actual = ctx.coaching;
  else if (rule.field === "lessonComplete") actual = ctx.completedLessonIds.includes(rule.value) ? rule.value : "";
  const hit = rule.field === "lessonComplete" ? actual === rule.value : actual === rule.value;
  return rule.operator === "is_not" ? !hit : hit;
}

export function popupMatchesFilters(
  filters: PopupFilterRule[],
  logic: PopupFilterLogic,
  ctx: PopupContext
): boolean {
  if (!filters.length) return true;
  return logic === "or" ? filters.some((rule) => fieldMatches(rule, ctx)) : filters.every((rule) => fieldMatches(rule, ctx));
}

export function visiblePopupItems(items: PopupItem[], ctx: PopupContext, responses: PopupResponse[]): PopupItem[] {
  return items.filter((item) => {
    if (item.kind === "activity") return !activityIsDone(item.activity, ctx, item.lessonId);
    if (item.kind === "commitment") {
      return !responses.some((row) => row.itemId === item.id && row.kind === "commitment" && row.accepted);
    }
    if (item.kind === "question") {
      return !responses.some((row) => row.itemId === item.id && row.kind === "answer" && row.answer.trim());
    }
    return true;
  });
}

export function popupHasContent(title: string, body: string, videoUrl: string, items: PopupItem[]): boolean {
  return Boolean(asProfileText(title) || asProfileText(body) || asProfileText(videoUrl) || items.length);
}

export function isPopupDismissed(dismissal: PopupDismissal | null | undefined, today = portalToday()): boolean {
  if (!dismissal) return false;
  if (dismissal.mode === "forever") return true;
  return dismissal.mode === "today" && dismissal.onDate === today;
}

export function skipIdsFromQuery(value: string | null | undefined): string[] {
  return String(value || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function dismissalsWithSkip(
  dismissals: PopupDismissal[],
  skipIds: string[],
  today = portalToday()
): PopupDismissal[] {
  return [
    ...dismissals,
    ...skipIds.map((popupId) => ({ popupId, mode: "forever" as const, onDate: today })),
  ];
}

export function popupSetupStamp(post: { id: string; createdAt?: string | null; publishedAt?: string | null }): string {
  return `${post.createdAt || post.publishedAt || ""}:${post.id}`;
}

export function sortPopupsBySetupOrder<T extends { id: string; createdAt?: string | null; publishedAt?: string | null }>(
  posts: T[]
): T[] {
  return [...posts].sort((left, right) => popupSetupStamp(left).localeCompare(popupSetupStamp(right)) || left.id.localeCompare(right.id));
}

export function pickMatchingPopup<T extends {
  id: string;
  filters: PopupFilterRule[];
  filterLogic: PopupFilterLogic;
  createdAt?: string | null;
  publishedAt?: string | null;
}>(
  posts: T[],
  ctx: PopupContext,
  dismissals: PopupDismissal[],
  today = portalToday(),
  skip?: (post: T) => boolean
): T | null {
  const hidden = new Set(
    dismissals.filter((row) => isPopupDismissed(row, today)).map((row) => row.popupId)
  );
  return (
    sortPopupsBySetupOrder(posts).find(
      (post) => !hidden.has(post.id) && popupMatchesFilters(post.filters, post.filterLogic, ctx) && !skip?.(post)
    ) || null
  );
}

export function commitmentFollowThrough(
  item: PopupCommitmentItem,
  ctx: PopupContext,
  accepted: boolean,
  today = portalToday()
): PopupFollowThrough | null {
  if (!accepted) return null;
  const linked = item.activity ? activityIsDone(item.activity, ctx, item.lessonId) : false;
  if (linked) return "followed_through";
  if (item.deadline && item.deadline < today) return "missed";
  return "open";
}

export function followThroughLabel(status: PopupFollowThrough | null): string {
  if (status === "followed_through") return "Followed through";
  if (status === "missed") return "Deadline passed";
  if (status === "open") return "In progress";
  return "Not agreed yet";
}

export function flattenPopupLessons(outline: OutlineChapter[]): { id: string; title: string }[] {
  return outline.flatMap((chapter) =>
    (chapter.lessons || []).map((lesson) => ({
      id: lesson.id,
      title: `${chapter.title} · ${lesson.title}`,
    }))
  );
}

export async function loadStudentPopupContext(
  userId: string,
  completedLessonIds: string[],
  courseAccess: "full" | "free_preview"
): Promise<PopupContext> {
  const empty: PopupContext = {
    courseAccess,
    onboarding: "pending",
    hasStudyPlan: false,
    journalThisWeek: false,
    journalNeed: "",
    scriptEval: "not_started",
    coaching: "none",
    completedLessonIds,
  };
  const client = getServiceSupabase() || getSupabase();
  if (!client) return empty;
  const weekStart = journalWeekStart();
  const [plan, journal, attempts, sessions, onboarding] = await Promise.all([
    client.from("study_plans").select("user_id").eq("user_id", userId).maybeSingle(),
    client.from("student_study_journal").select("*").eq("user_id", userId).eq("week_start", weekStart).maybeSingle(),
    client.from("exam_attempts").select("*").eq("user_id", userId),
    client.from("student_coaching_sessions").select("status").eq("student_id", userId),
    client.from("student_profiles").select("onboarding_completed, onboarding_skipped").eq("student_id", userId).maybeSingle(),
  ]);
  const sitting = ((attempts.data || []) as Record<string, unknown>[])
    .map((row) => examAttemptFromRow(row))
    .filter((row) => row.source !== STAFF_TEST_ATTEMPT_SOURCE);
  let scriptEval: PopupContext["scriptEval"] = "not_started";
  if (sitting.some((row) => isAttemptSubmitted(row.status))) scriptEval = "submitted";
  else if (sitting.some(attemptHasAnyUploadedFile)) scriptEval = "uploaded";
  const sessionRows = (sessions.data || []) as { status?: string }[];
  let coaching: PopupContext["coaching"] = "none";
  if (sessionRows.some((row) => row.status === "completed")) coaching = "completed";
  else if (sessionRows.some((row) => row.status === "scheduled")) coaching = "booked";
  const onboard = onboarding.data as { onboarding_completed?: boolean; onboarding_skipped?: boolean } | null;
  const onboardingStatus = onboard?.onboarding_completed ? "completed" : onboard?.onboarding_skipped ? "skipped" : "pending";
  const week = journal.data ? weekFromRow(journal.data as Record<string, unknown>, weekStart) : null;
  return {
    ...empty,
    onboarding: onboarding.error ? "pending" : onboardingStatus,
    hasStudyPlan: Boolean(plan.data),
    journalThisWeek: week ? journalWeekFilled(week) : false,
    journalNeed: week?.weekNeed || "",
    scriptEval,
    coaching,
  };
}

export function popupTableMissing(message: string): boolean {
  return /student_popup_dismissals|student_popup_responses|dashboard_posts|filters|items|schema cache|could not find/i.test(message);
}

export function popupError(message: string): string {
  if (popupTableMissing(message) || /row-level security|not allowed|policy|unauthorized|403/i.test(message)) {
    return STUDENT_POPUPS_SQL_HINT;
  }
  return message || "Could not update that pop-up.";
}
