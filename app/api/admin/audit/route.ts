import { NextResponse } from "next/server";
import { auditCourseData } from "@/lib/auditCourse";
import { isCoachAccount } from "@/lib/roles";
import { getStudentUser } from "@/lib/student-lesson";

export const dynamic = "force-dynamic";

function authorized(request: Request, isCoach: boolean): boolean {
  const secret = process.env.AUDIT_SECRET;
  const header = request.headers.get("x-audit-secret") || request.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (secret && token === secret) return true;
  if (isCoach) return true;
  return process.env.NODE_ENV !== "production";
}

export async function GET(request: Request) {
  const user = await getStudentUser();
  if (!authorized(request, isCoachAccount(user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const report = await auditCourseData();
  return NextResponse.json(report, {
    headers: { "Cache-Control": "no-store" },
  });
}
