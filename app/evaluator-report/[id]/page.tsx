import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import { attemptReportSections, latestDatasetPerPaper } from "@/lib/evaluator/attempt-report";
import { jobsForAttempt } from "@/lib/evaluator/jobs";
import { renderReportBody, REPORT_CSS } from "@/lib/evaluator/report-html";
import type { EvaluationDataset } from "@/lib/evaluator/types";
import { profileDisplayName } from "@/lib/profiles";
import { getServiceSupabase } from "@/lib/supabase-admin";
import PrintButton from "@/app/evaluator-preview/PrintButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Your Script Evaluator report", robots: { index: false, follow: false } };

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
export default async function EvaluatorReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getRequestUser();
  if (!user) return <Message><p>Please sign in to see your report.</p></Message>;
  const staff = isStaffUser(user);
  const supabase = getServiceSupabase();
  if (!supabase) return <Message><p>The report is not available right now.</p></Message>;

  const { data: attemptRow } = await supabase
    .from("exam_attempts")
    .select("id, user_id, sitting_label, evaluator_report_released_at")
    .eq("id", id)
    .maybeSingle();
  const attempt = attemptRow as { id: string; user_id: string; sitting_label: string; evaluator_report_released_at: string | null } | null;
  if (!attempt || (!staff && attempt.user_id !== user.id)) return <Message><p>That report was not found.</p></Message>;
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

  const { data: profile } = await supabase.from("profiles").select("email, full_name").eq("id", attempt.user_id).maybeSingle();
  const p = profile as { email?: string; full_name?: string | null } | null;
  const studentName = p ? profileDisplayName(p.email || "", p.full_name) : undefined;
  const sections = attemptReportSections(datasets, studentName);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: REPORT_CSS }} />
      <div className="no-print" style={{ padding: 12, fontFamily: "Arial", background: "#f2f2f2" }}>
        <PrintButton /> <Link href="/student/evaluator" style={{ marginLeft: 12 }}>Back to the Script Evaluator</Link>
        {staff ? (
          <span style={{ marginLeft: 12, fontSize: 13 }}>
            Staff view. {attempt.evaluator_report_released_at ? "Released to the student." : "Not released yet."} <Link href="/coach/evaluator">Review list</Link>
          </span>
        ) : (
          <span style={{ marginLeft: 12, fontSize: 13 }}>To keep a copy, choose Save as PDF and untick Headers and footers.</span>
        )}
      </div>
      <div className="eve-report" dangerouslySetInnerHTML={{ __html: renderReportBody(sections) }} />
    </>
  );
}
