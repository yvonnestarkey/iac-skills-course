import type { Metadata } from "next";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import { getServiceSupabase } from "@/lib/supabase-admin";
import { attemptReportSections, latestDatasetPerPaper } from "@/lib/evaluator/attempt-report";
import { renderReportBody, REPORT_CSS } from "@/lib/evaluator/report-html";
import { PAPER_NAMES } from "@/lib/evaluator/report-text";
import type { EvaluationDataset } from "@/lib/evaluator/types";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Evaluator report preview (staff only)", robots: { index: false, follow: false } };

type RunRow = { id: string; attempt_id: string; kind: string; created_at: string; model: string; paper: string | null };

/**
 * Staff-only preview (Yvonne, 16 Oct 2026). Reads SAVED evaluator runs (evaluator_runs), so viewing costs nothing and
 * never calls the model. With no ?runs= it lists recent runs to pick from; with ?runs=<id>&runs=<id>... it renders the
 * Overall Report and one Per Paper Report per paper, in the brand layout, ready to Save as PDF.
 */
export default async function EvaluatorPreviewPage({ searchParams }: { searchParams: Promise<{ runs?: string | string[]; name?: string }> }) {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return <main style={{ padding: 24, fontFamily: "Arial" }}><p>Staff only. Please sign in with a coach account.</p></main>;
  const supabase = getServiceSupabase();
  if (!supabase) return <main style={{ padding: 24, fontFamily: "Arial" }}><p>The server is missing its Supabase service key.</p></main>;

  const params = await searchParams;
  const ids = (Array.isArray(params.runs) ? params.runs : params.runs ? [params.runs] : []).flatMap((v) => v.split(",")).filter(Boolean);

  if (!ids.length) {
    const { data, error } = await supabase.from("evaluator_runs").select("id, attempt_id, kind, created_at, model, paper:dataset->>paper_id").order("created_at", { ascending: false }).limit(40);
    const runs = (data ?? []) as unknown as RunRow[];
    return (
      <main style={{ padding: 24, fontFamily: "Arial, Helvetica, sans-serif", maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ color: "#124f5c" }}>Evaluator report preview</h1>
        <p>Tick one run for each paper (up to three), then click Show report. Viewing does not run the evaluator or cost anything.</p>
        {error ? <p style={{ color: "#980000" }}>Could not read evaluator_runs: {error.message}</p> : null}
        {!runs.length && !error ? <p>No saved runs yet. Run the evaluator on an attempt first (staff endpoint or calibration script).</p> : null}
        <form method="get">
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead><tr>{["", "Paper", "Kind", "Saved", "Model", "Run id"].map((h) => <th key={h} style={{ textAlign: "left", borderBottom: "1px solid #000", padding: 4 }}>{h}</th>)}</tr></thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td style={{ padding: 4 }}><input type="checkbox" name="runs" value={r.id} /></td>
                  <td style={{ padding: 4 }}>{r.paper ? `${r.paper}${PAPER_NAMES[r.paper] ? ` (${PAPER_NAMES[r.paper]})` : ""}` : "?"}</td>
                  <td style={{ padding: 4 }}>{r.kind}</td>
                  <td style={{ padding: 4 }}>{new Date(r.created_at).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })}</td>
                  <td style={{ padding: 4 }}>{r.model}</td>
                  <td style={{ padding: 4, fontSize: 11 }}>{r.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p><button type="submit" style={{ padding: "8px 14px", fontSize: 14 }}>Show report</button></p>
        </form>
      </main>
    );
  }

  const { data, error } = await supabase.from("evaluator_runs").select("id, created_at, dataset").in("id", ids);
  if (error || !data?.length) return <main style={{ padding: 24, fontFamily: "Arial" }}><p>Could not load those runs{error ? `: ${error.message}` : "."}</p></main>;
  const datasets = latestDatasetPerPaper(data as unknown as { created_at: string; dataset: EvaluationDataset }[]);
  const studentName = params.name?.trim() || undefined;
  const sections = attemptReportSections(datasets, studentName);
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: REPORT_CSS }} />
      <div className="no-print" style={{ padding: 12, fontFamily: "Arial", background: "#f2f2f2" }}>
        <PrintButton /> <a href="/evaluator-preview" style={{ marginLeft: 12 }}>Back to the list</a>
        <span style={{ marginLeft: 12, fontSize: 13 }}>Staff preview of saved runs. {datasets.length} paper(s) shown{ids.length > datasets.length ? " (older runs of the same paper were skipped)" : ""}.</span>
      </div>
      <div className="eve-report" dangerouslySetInnerHTML={{ __html: renderReportBody(sections) }} />
    </>
  );
}
