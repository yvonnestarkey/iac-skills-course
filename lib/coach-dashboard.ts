import { courseAccessFromEntitlementStatus } from "./course-access";
import type { SurveySubmissionRow } from "./custom-surveys";
import { isoToSastDateAndTime } from "./dates";

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

export const COACH_MARKING_PREVIEW = 8;

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
