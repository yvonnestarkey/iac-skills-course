import type { Student, StudyPlan } from "./types";

export function studentFromPlan(
  userId: string,
  plan: StudyPlan,
  extras?: { email?: string | null; name?: string; completed?: string[] }
): Student {
  const completed = extras?.completed || [];
  const submissions: Record<string, string> = {};
  completed.forEach((id) => {
    submissions[id] = "Completed";
  });
  return {
    id: userId,
    name: extras?.name || extras?.email || "Student",
    email: extras?.email || "",
    cohort: "autumn26",
    status: "active",
    completed,
    submissions,
    plan,
  };
}
