import type { RunResult } from "./run";

const pct = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)}%`);

function mostCommon(values: string[]): string {
  if (!values.length) return "—";
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

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
  lines.push("| Req | Attempted | Marks (tech/avail) | BMCR known | BMCR conv. | BMCR verdict | Direct conv. | Indirect conv. | Thinking conv. | Volume | Accuracy | Components (avail/rec/expl) | Core issue | RTFQ (shape/directions/lens) | Comm. | Type | Competency |");
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
        req.components ? req.components.layers.map((l) => `${l.layer} ${l.recognised}/${l.available}`).join("; ") || "—" : "—",
        req.core_issue ? `${req.core_issue.higher_covered}/${req.core_issue.higher_total} higher` : "—",
        req.rtfq ? req.rtfq.dimensions.map((d) => d.delivered).join("/") || "—" : "—",
        req.communication ? mostCommon(req.communication.points.map((p) => p.category)) : "—",
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
  const withCore = dataset.requirements.filter((req) => req.core_issue?.components.length);
  if (withCore.length) {
    lines.push("");
    lines.push("## Core Issue (which components deserved more of your time)");
    for (const req of withCore) {
      if (req.core_issue!.off_plan_note) lines.push("", `_Expanded or contracted differently from the case (valid points, not wrong): ${req.core_issue!.off_plan_note}_`);
      lines.push("", `**${req.label}**: ${req.core_issue!.higher_covered} of ${req.core_issue!.higher_total} higher-priority components covered (${req.core_issue!.alignment ?? "n/a"})${req.core_issue!.dominant_covered === false ? "; the dominant component was not covered" : ""}`, "", "| Component | Priority | Clue the case gave | Your statements | Depth |", "|---|---|---|---|---|");
      for (const c of req.core_issue!.components) lines.push(`| ${c.component} | ${c.priority} | ${c.clue} | ${c.attempts} | ${c.depth} |`);
    }
  }
  const withComm = dataset.requirements.filter((req) => req.communication?.points.length);
  if (withComm.length) {
    lines.push("");
    lines.push("## Communication (coach view: point by point; students see the trend only)");
    for (const req of withComm) {
      const o = req.communication!.overall;
      lines.push("", `**${req.label}**${req.discussion_basis ? ` (${req.discussion_basis === "compliance" ? "rules" : "tools"})` : ""}: ${req.communication!.trend}`);
      if (o) lines.push("", `Overall: introduction ${o.introduction.replace("_", " ")}${o.introduction_note ? ` (${o.introduction_note})` : ""}${o.knowledge ? `; theory ${o.knowledge}, application ${o.application}, so what ${o.so_what}` : ""}. ${o.note}`);
      lines.push("", "| # | Statement | Category | Note |", "|---|---|---|---|");
      for (const p of req.communication!.points) lines.push(`| ${p.n} | ${p.statement} | ${p.category} | ${p.note} |`);
    }
  }
  const withRtfq = dataset.requirements.filter((req) => req.rtfq?.dimensions.length);
  if (withRtfq.length) {
    lines.push("");
    lines.push("## RTFQ (what the required asked for, and what was delivered)");
    for (const req of withRtfq) {
      lines.push("", `**${req.label}**`, "", "| Dimension | What the required asked for | Delivered? | Note |", "|---|---|---|---|");
      for (const d of req.rtfq!.dimensions) lines.push(`| ${d.dimension} | ${d.required} | ${d.delivered} | ${d.note} |`);
    }
  }
  const withComponents = dataset.requirements.filter((req) => req.components?.layers.length);
  if (withComponents.length) {
    lines.push("");
    lines.push("## Components (available -> recognised -> exploited)");
    for (const req of withComponents) {
      lines.push("", `**${req.label}**`, "", "| Layer | Available | Recognised | Exploited | Note |", "|---|---|---|---|---|");
      for (const l of req.components!.layers) lines.push(`| ${l.layer} | ${l.available} | ${l.recognised} | ${l.exploited} | ${l.note} |`);
    }
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
    if (report.coach_hypotheses?.length) {
      lines.push("", "### Coach hypotheses: whole-script skill gaps (not for the student)");
      for (const h of report.coach_hypotheses) {
        lines.push("", `**${h.skill_gap}** _(${h.confidence}; ${h.evidence_requirements.join(", ") || "no requirement evidence"})_`);
        lines.push(`- **Pattern:** ${h.pattern}`, `- **Evidence:** ${h.evidence.join("; ")}`, `- **Working hypothesis:** ${h.working_hypothesis}`);
        lines.push(`- **Confirm if:** ${h.would_confirm}`, `- **Reject if:** ${h.would_reject}`, `- **Probe:** ${h.probe}`, `- **Train:** ${h.skill_to_train}`);
      }
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
