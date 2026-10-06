import type { RunResult } from "./run";

const pct = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)}%`);

/**
 * Review sheet for calibration: requirements as rows, measures as columns, so recurring weak patterns
 * are visible at a glance. Then the generated report, for Yvonne to compare with her own evaluation.
 */
export function renderCalibrationMarkdown(result: RunResult): string {
  const { dataset, report, usage } = result;
  const lines: string[] = [];
  lines.push(`# Calibration review — attempt ${dataset.attempt_id}`);
  lines.push("");
  lines.push(`Sitting/paper: ${dataset.sitting_id} / ${dataset.paper_id} · model: ${dataset.model} · ${usage.calls} calls, ${usage.input_tokens} in / ${usage.output_tokens} out tokens`);
  lines.push("");
  lines.push("## Answer order (as written by the candidate)");
  lines.push(dataset.page_map.answer_order.join(" → ") || "—");
  lines.push("");
  lines.push("## Requirements × measures");
  lines.push("");
  lines.push("| Req | Attempted | Marks (tech/avail) | BMCR known | BMCR conv. | BMCR verdict | Direct conv. | Indirect conv. | Thinking conv. | Volume | Accuracy | Components (avail/rec/expl) | Core issue | RTFQ (shape/dir/lens) | Comm. | Type | Competency |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const req of dataset.requirements) {
    const m = dataset.metrics.find((x) => x.code === req.code);
    const yn = (v: boolean) => (v ? "Y" : "N");
    lines.push(
      [
        req.label,
        req.attempted ? "Y" : "N",
        `${req.technical_awarded ?? "?"}/${req.total_marks}`,
        req.bmcr.student_known ?? "?",
        pct(m?.bmcr_conversion ?? null),
        m?.bmcr_verdict ?? "—",
        pct(m?.proximity_conversion.direct ?? null),
        pct(m?.proximity_conversion.indirect ?? null),
        pct(m?.proximity_conversion.thinking ?? null),
        req.volume?.attempts ?? "—",
        pct(m?.accuracy ?? null),
        req.components ? `${yn(req.components.available)}/${yn(req.components.recognised)}/${yn(req.components.exploited)}` : "—",
        req.core_issue?.alignment ?? "—",
        req.rtfq ? `${yn(req.rtfq.delivered_shape)}/${yn(req.rtfq.delivered_directions)}/${yn(req.rtfq.delivered_lens)}` : "—",
        req.communication?.rating ?? "—",
        req.question_type,
        req.competency.topic,
      ].join(" | ").replace(/^/, "| ").replace(/$/, " |")
    );
  }
  lines.push("");
  lines.push("## Quick comment per requirement (observation, with certainty)");
  for (const req of dataset.requirements) {
    lines.push(`- **${req.label}** (${req.quick_comment.certainty}): ${req.quick_comment.main_issue ?? "no single issue supported"} — _${req.quick_comment.evidence}_`);
  }
  if (dataset.warnings.length) {
    lines.push("");
    lines.push("## Warnings");
    for (const w of dataset.warnings) lines.push(`- ${w}`);
  }
  if (report) {
    lines.push("");
    lines.push("## Generated report");
    lines.push(`**${report.headline}**`);
    for (const p of report.patterns) {
      lines.push("");
      lines.push(`### ${p.title} _(${p.confidence})_`);
      lines.push(`- **What we see:** ${p.what_we_see}`);
      lines.push(`- **Evidence:** ${p.evidence.join("; ")}`);
      lines.push(`- **Why it matters:** ${p.why_it_matters}`);
      lines.push(`- **Tool:** ${p.relevant_tool}`);
      for (const h of p.working_hypotheses) lines.push(`- **Working hypothesis:** ${h.hypothesis} (confirm: ${h.would_confirm}; reject: ${h.would_reject})`);
      lines.push(`- **Probe:** ${p.probe_question}`);
      lines.push(`- **Next step:** ${p.next_step}`);
    }
    if (report.technical_gaps.length) lines.push("", "### Technical gaps", ...report.technical_gaps.map((g) => `- ${g}`));
    if (report.still_to_investigate.length) lines.push("", "### Still to investigate", ...report.still_to_investigate.map((g) => `- ${g}`));
    if (report.coach_flags.length) lines.push("", "### Coach flags (not for the student)", ...report.coach_flags.map((f) => `- [${f.type}] ${f.note}`));
  }
  lines.push("");
  lines.push("## Your review (fill in)");
  lines.push("Where does your own evaluation differ from the above? Per requirement and per pattern: Keep / Edit / Remove / Wrong diagnosis.");
  return lines.join("\n");
}
