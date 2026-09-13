import type { StudentUser } from "./student-lesson";

const DEFAULT_COACH_EMAILS = [
  "coach@accountingstudyadvice.com",
  "admin@accountingstudyadvice.com",
  "yvonne@accountingstudyadvice.com",
];

function allowedCoachEmails(): string[] {
  const fromEnv = (process.env.NEXT_PUBLIC_COACH_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...DEFAULT_COACH_EMAILS, ...fromEnv])];
}

/** True only for coach/admin accounts — regular students such as s1@test.com stay hidden. */
export function isCoachAccount(user: StudentUser | null | undefined): boolean {
  if (!user) return false;
  const role = (user.role || "").toLowerCase();
  if (role === "coach" || role === "admin") return true;
  const email = (user.email || "").toLowerCase();
  return Boolean(email) && allowedCoachEmails().includes(email);
}
