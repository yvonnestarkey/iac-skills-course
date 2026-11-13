import { courseAccessFromEntitlementStatus } from "./course-access";
import type { SurveySubmissionRow } from "./custom-surveys";
import { daysAgo, isoToSastDateAndTime, parsePortalTimestamp } from "./dates";
import { EXAM_ATTEMPT_STATUSES, isAttemptSubmitted, type ExamAttemptStatus } from "./exam-attempts";
import { fetchCoachSentMessages } from "./inbox";
import { STAFF_TEST_ATTEMPT_SOURCE } from "./staff-access";
import { getSupabase } from "./supabase";
import type { Student } from "./types";

export type CoachDashTab = "bmcr";

export type CoachDashTool = {
  id: string;
  title: string;
  description: string;
  href: string;
  tab?: CoachDashTab;
  catalog?: boolean;
};

export type CoachDashGroup = {
  id: string;
  title: string;
  blurb: string;
  items: CoachDashTool[];
};

export type CoachStudentCounts = {
  paid: number;
  free: number;
  deregistered: number;
};

export type CoachMarkingItem = {
  id: string;
  href: string;
  studentName: string;
  title: string;
  createdAt: string;
};

export const COACH_STALE_DAYS = 7;

export type CoachWatchKind = "disengaged" | "quiet";

export type CoachWatchStudent = {
  id: string;
  name: string;
  lastActive?: string | null;
  lastHeardAt?: string | null;
};

export const COACH_DASHBOARD_GROUPS: CoachDashGroup[] = [
  {
    id: "students",
    title: "Students",
    blurb: "People, lists, and conversations",
    items: [
      {
        id: "lists",
        title: "Student lists",
        description: "Roster, submissions, surveys, and activity",
        href: "/coach/lists",
      },
      {
        id: "add-student",
        title: "Add Student",
        description: "Invite someone to free preview or complimentary full access",
        href: "/coach/students/new",
      },
      {
        id: "inbox",
        title: "Inbox",
        description: "Student questions and assignment feedback",
        href: "/coach/inbox",
      },
      {
        id: "surveys",
        title: "Custom surveys",
        description: "Build forms, collect answers, and export CSV",
        href: "/coach/surveys",
      },
      {
        id: "student-course",
        title: "Student course",
        description: "The live student dashboard, lessons, live sessions, and Script Evaluator",
        href: "/student",
      },
      {
        id: "catalog",
        title: "All courses",
        description: "Catalog at class.accountingstudyadvice.com. IAC Skills stays on iac.",
        href: "/courses",
        catalog: true,
      },
    ],
  },
  {
    id: "classroom",
    title: "Classroom",
    blurb: "What students see and hear from you",
    items: [
      {
        id: "dashboard-posts",
        title: "Dashboard posts",
        description: "Banner announcements and the login slide-in",
        href: "/coach/dashboard-posts",
      },
      {
        id: "builder",
        title: "Course creator",
        description: "Add lessons, live Zoom sessions, and import CSV content",
        href: "/coach/builder",
      },
      {
        id: "tools",
        title: "Tools",
        description: "Edit the Reading & RTFQ Tool and other dashboard tools",
        href: "/coach/tools",
      },
      {
        id: "drips",
        title: "Drip-feed messages",
        description: "After enrolment, on a date, or when they complete a lesson or task",
        href: "/coach/drips",
      },
      {
        id: "fireflies",
        title: "Fireflies",
        description: "Connect transcripts and summaries from 1-on-1 coaching calls",
        href: "/coach/fireflies",
      },
      {
        id: "account",
        title: "Your profile",
        description: "Edit your name, email, and phone number",
        href: "/coach/account",
      },
    ],
  },
  {
    id: "work",
    title: "Marking & money",
    blurb: "Reports, training, and cash",
    items: [
      {
        id: "evaluator",
        title: "Script Evaluator reports",
        description: "Progress per paper, review and release reports, and the on/off switch",
        href: "/coach/evaluator",
      },
      {
        id: "bmcr",
        title: "BMCR Analytics",
        description: "Cohort conversion, diagnostic tiers, and task comparison",
        href: "/coach/lists",
        tab: "bmcr",
      },
      {
        id: "eve",
        title: "Eve training data",
        description: "Your feedback, anonymised and paired with their work",
        href: "/coach/eve-training",
      },
      {
        id: "commerce",
        title: "Payments & referrals",
        description: "Entitlement, Stripe status, and credits needing manual action",
        href: "/coach/commerce",
      },
      {
        id: "revenue",
        title: "Revenue",
        description: "Monthly sales, instalments, cash, referrals, and student statements",
        href: "/coach/revenue",
      },
      {
        id: "referrals",
        title: "Referrals",
        description: "Successful student and professional colleague referrals, including payout records",
        href: "/coach/referrals",
      },
    ],
  },
];

export function coachDashboardGreeting(now: Date = new Date()): string {
  const hour = Number((isoToSastDateAndTime(now).time || "12:00").slice(0, 2));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function coachStudentCounts(
  students: Array<{ courseAccess?: string | null; accessActive?: boolean }>
): CoachStudentCounts {
  let paid = 0;
  let free = 0;
  let deregistered = 0;
  for (const student of students) {
    if (student.accessActive === false) {
      deregistered += 1;
      continue;
    }
    if (courseAccessFromEntitlementStatus(student.courseAccess) === "full") paid += 1;
    else free += 1;
  }
  return { paid, free, deregistered };
}

export function markingHref(row: Pick<SurveySubmissionRow, "id" | "href">): string {
  return row.href || `/coach/submissions/${row.id}`;
}

export function coachMarkingItems(rows: SurveySubmissionRow[]): CoachMarkingItem[] {
  return rows
    .filter((row) => row.isAssignment && row.status === "submitted")
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .map((row) => ({
      id: row.id,
      href: markingHref(row),
      studentName: row.studentName || "Student",
      title: row.surveyTitle || "Assignment",
      createdAt: row.createdAt || "",
    }));
}

export function coachDashboardTools(): CoachDashTool[] {
  return COACH_DASHBOARD_GROUPS.flatMap((group) => group.items);
}

export function isActiveRosterStudent(student: { accessActive?: boolean; status?: string }): boolean {
  return student.accessActive !== false && student.status !== "paused";
}

export function isPaidCourseStudent(student: {
  courseAccess?: string | null;
  accessActive?: boolean;
  status?: string;
}): boolean {
  return isActiveRosterStudent(student) && courseAccessFromEntitlementStatus(student.courseAccess) === "full";
}

export function isDisengagedStudent(
  student: Pick<Student, "lastActive" | "accessActive" | "status" | "courseAccess">
): boolean {
  if (!isPaidCourseStudent(student)) return false;
  const days = daysAgo(student.lastActive);
  return days === null || days >= COACH_STALE_DAYS;
}

export function heardFromCoachWithinDays(
  lastHeardAt: string | null | undefined,
  days = COACH_STALE_DAYS,
  now: Date = new Date()
): boolean {
  if (!lastHeardAt) return false;
  const at = parsePortalTimestamp(lastHeardAt)?.getTime() || Date.parse(lastHeardAt);
  if (!at || Number.isNaN(at)) return false;
  return now.getTime() - at < days * 86400000;
}

export function isQuietStudent(
  student: Pick<Student, "lastActive" | "accessActive" | "status" | "courseAccess">,
  lastHeardAt: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!isPaidCourseStudent(student)) return false;
  if (isDisengagedStudent(student)) return false;
  return !heardFromCoachWithinDays(lastHeardAt, COACH_STALE_DAYS, now);
}

export function coachWatchStudents(
  students: Student[],
  kind: CoachWatchKind,
  lastHeardById: Record<string, string | null> = {},
  now: Date = new Date()
): CoachWatchStudent[] {
  return students
    .filter((student) =>
      kind === "disengaged" ? isDisengagedStudent(student) : isQuietStudent(student, lastHeardById[student.id], now)
    )
    .map((student) => ({
      id: student.id,
      name: student.name,
      lastActive: student.lastActive || null,
      lastHeardAt: lastHeardById[student.id] || null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function isAwaitingEvaluatorReport(row: {
  status?: string | null;
  evaluator_report_released_at?: string | null;
  source?: string | null;
}): boolean {
  if (row.source === STAFF_TEST_ATTEMPT_SOURCE) return false;
  if (row.evaluator_report_released_at) return false;
  const status = EXAM_ATTEMPT_STATUSES.includes(row.status as ExamAttemptStatus)
    ? (row.status as ExamAttemptStatus)
    : "started";
  return isAttemptSubmitted(status);
}

export function awaitingEvaluatorReportCount(
  rows: Array<{ status?: string | null; evaluator_report_released_at?: string | null; source?: string | null }>
): number {
  return rows.filter(isAwaitingEvaluatorReport).length;
}

export function laterStamp(left: string | null | undefined, right: string | null | undefined): string | null {
  const a = String(left || "");
  const b = String(right || "");
  if (!a) return b || null;
  if (!b) return a;
  return a > b ? a : b;
}

export function mergeLastHeardByStudent(
  students: Array<{ id: string; email?: string | null }>,
  contacts: Array<{ studentId?: string | null; studentEmail?: string | null; at?: string | null }>
): Record<string, string | null> {
  const byId = new Map<string, string | null>(students.map((student) => [student.id, null]));
  const emailToId = new Map<string, string>();
  for (const student of students) {
    const email = String(student.email || "").trim().toLowerCase();
    if (email) emailToId.set(email, student.id);
  }
  for (const contact of contacts) {
    const at = String(contact.at || "");
    if (!at) continue;
    const fromId = contact.studentId && byId.has(contact.studentId) ? contact.studentId : "";
    const fromEmail = emailToId.get(String(contact.studentEmail || "").trim().toLowerCase()) || "";
    const id = fromId || fromEmail;
    if (!id) continue;
    byId.set(id, laterStamp(byId.get(id), at));
  }
  return Object.fromEntries(byId);
}

export async function fetchAwaitingEvaluatorReports(): Promise<number> {
  const client = getSupabase();
  if (!client) return 0;
  const { data, error } = await client
    .from("exam_attempts")
    .select("status, evaluator_report_released_at, source")
    .is("evaluator_report_released_at", null);
  if (error || !data) return 0;
  return awaitingEvaluatorReportCount(data as Array<{ status?: string; evaluator_report_released_at?: string | null; source?: string | null }>);
}

export async function fetchLastHeardByStudent(
  students: Array<{ id: string; email?: string | null }>
): Promise<Record<string, string | null>> {
  const client = getSupabase();
  const contacts: Array<{ studentId?: string | null; studentEmail?: string | null; at?: string | null }> = [];
  const inbox = await fetchCoachSentMessages();
  if (inbox.ok) {
    inbox.data.forEach((message) => {
      if (message.from !== "coach") return;
      contacts.push({ studentId: message.studentId, studentEmail: message.studentEmail, at: message.createdAt });
    });
  }
  if (client) {
    const since = new Date(Date.now() - COACH_STALE_DAYS * 86400000).toISOString();
    const { data } = await client
      .from("notifications")
      .select("user_id, student_id, student_email, created_at, from_role")
      .eq("from_role", "coach")
      .gte("created_at", since);
    (data || []).forEach((row) => {
      contacts.push({
        studentId: String(row.student_id || row.user_id || "") || null,
        studentEmail: String(row.student_email || "") || null,
        at: String(row.created_at || ""),
      });
    });
  }
  return mergeLastHeardByStudent(students, contacts);
}
