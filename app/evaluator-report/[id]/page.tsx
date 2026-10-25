import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import { attemptReportSections, latestDatasetPerPaper } from "@/lib/evaluator/attempt-report";
import { jobsForAttempt } from "@/lib/evaluator/jobs";
import { renderReportBody, REPORT_CSS } from "@/lib/evaluator/report-html";
import { courseDisplayName, reportFileTitle } from "@/lib/evaluator/report-naming";
import type { EvaluationDataset } from "@/lib/evaluator/types";
import { getServiceSupabase } from "@/lib/supabase-admin";
import PrintButton from "@/app/evaluator-preview/PrintButton";
import AutoPrint from "./AutoPrint";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AttemptOwner = {
  id: string;
  user_id: string;
  sitting_id: string;
  sitting_label: string;
  evaluator_report_released_at: string | null;
  coach_report_url?: string | null;
  name: string;
};

/** The attempt and the student's name as the course shows it. */
async function loadAttemptOwner(id: string): Promise<AttemptOwner | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;
  const full = await supabase
    .from("exam_attempts")
    .select("id, user_id, sitting_id, sitting_label, evaluator_report_released_at, coach_report_url")
    .eq("id", id)
    .maybeSingle();
  const data =
    full.data ??
    (
      await supabase
        .from("exam_attempts")
        .select("id, user_id, sitting_id, sitting_label, evaluator_report_released_at")
        .eq("id", id)
        .maybeSingle()
    ).data;
  const attempt = data as Omit<AttemptOwner, "name"> | null;
  if (!attempt) return null;
  const { data: profile } = await supabase.from("profiles").select("email, full_name").eq("id", attempt.user_id).maybeSingle();
  const p = profile as { email?: string; full_name?: string | null } | null;
  let authFullName: string | null = null;
  let email = p?.email ?? null;
  if (!p?.full_name?.trim()) {
    try {
      const { data: auth } = await supabase.auth.admin.getUserById(attempt.user_id);
      const meta = auth?.user?.user_metadata as { full_name?: unknown } | undefined;
      authFullName = typeof meta?.full_name === "string" ? meta.full_name : null;
      email = email ?? auth?.user?.email ?? null;
    } catch {
      // fall back to the email address
    }
  }
  return { ...attempt, name: courseDisplayName({ profileFullName: p?.full_name, authFullName, email }) };
}

/** The page title is the file name the browser suggests when the report is saved as a PDF, e.g. "S4 Jun26 Script Evaluation". */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const owner = await loadAttemptOwner(id).catch(() => null);
  return {
    title: owner ? reportFileTitle(owner.name, owner.sitting_id, owner.sitting_label) : "Script Evaluation",
    robots: { index: false, follow: false },
  };
}

function Message({ children }: { children: ReactNode }) {
  return (
    <main style={{ padding: 24, fontFamily: "Arial, Helvetica, sans-serif", maxWidth: 720, margin: "0 auto" }}>
      {children}
      <p style={{ marginTop: 18 }}>
        <Link href="/student/evaluator">Back to the Script Evaluator</Link>
      </p>
    </main>
  );
}

/**
 * The student's report for one whole-sitting attempt. The student sees it once Yvonne has released it; staff can open
 * it at any time (that is the review step). Built from the saved datasets at view time: no model call, no cost.
 */
export default async function EvaluatorReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string; embed?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const embed = query.embed === "1";
  const user = await getRequestUser();
  if (!user) return <Message><p>Please sign in to see your report.</p></Message>;
  const staff = isStaffUser(user);
  const supabase = getServiceSupabase();
  if (!supabase) return <Message><p>The report is not available right now.</p></Message>;

  const attempt = await loadAttemptOwner(id);
  if (!attempt || (!staff && attempt.user_id !== user.id)) return <Message><p>That report was not found.</p></Message>;
  if (!staff && attempt.evaluator_report_released_at && attempt.coach_report_url) {
    redirect(attempt.coach_report_url);
  }
  if (!staff && !attempt.evaluator_report_released_at) {
    return (
      <Message>
        <h1 style={{ color: "#124f5c" }}>Your report is nearly ready</h1>
        <p>Your scripts have been evaluated and Yvonne is checking your report before it is released. You will be able to open it here as soon as she has.</p>
      </Message>
    );
  }

  const runIds = (await jobsForAttempt(id).catch(() => [])).map((j) => j.run_id).filter((x): x is string => Boolean(x));
  if (!runIds.length) return <Message><p>The report is still being prepared.</p></Message>;
  const { data: runs } = await supabase.from("evaluator_runs").select("created_at, dataset").in("id", runIds);
  const datasets = latestDatasetPerPaper((runs ?? []) as unknown as { created_at: string; dataset: EvaluationDataset }[]);
  if (!datasets.length) return <Message><p>The report is still being prepared.</p></Message>;
  const sections = attemptReportSections(datasets, attempt.name);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: REPORT_CSS }} />
      {query.print === "1" ? <AutoPrint /> : null}
      {embed ? null : (
      <div className="no-print" style={{ padding: 12, fontFamily: "Arial", background: "#f2f2f2" }}>
        <PrintButton /> <Link href="/student/evaluator" style={{ marginLeft: 12 }}>Back to the Script Evaluator</Link>
        {staff ? (
          <span style={{ marginLeft: 12, fontSize: 13 }}>
            Staff view. {attempt.evaluator_report_released_at ? "Released to the student." : "Not released yet."}
            {attempt.coach_report_url ? (
              <>
                {" "}
                A manual PDF is uploaded
                {attempt.evaluator_report_released_at ? " and that is what the student sees." : "; release will send that PDF."}{" "}
                <a href={attempt.coach_report_url} target="_blank" rel="noopener noreferrer">
                  Open uploaded PDF
                </a>
                .
              </>
            ) : null}{" "}
            <Link href="/coach/evaluator">Review list</Link>
          </span>
        ) : (
          <span style={{ marginLeft: 12, fontSize: 13 }}>To keep a copy, choose Save as PDF as the destination.</span>
        )}
      </div>
      )}
      <div className="eve-report" dangerouslySetInnerHTML={{ __html: renderReportBody(sections) }} />
    </>
  );
}
