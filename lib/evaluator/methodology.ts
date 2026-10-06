import toolsData from "@/lib/data/eve-tools/tools.json";
import rulesData from "@/lib/data/eve-rules/rules.json";

type Doc = { id: string; title: string; content: string };

const toolDocs = (toolsData as { documents: Doc[] }).documents;
const ruleDocs = (rulesData as { documents: Doc[] }).documents;

function doc(id: string): string {
  const found = toolDocs.find((item) => item.id === id);
  return found ? found.content.trim() : "";
}

function block(title: string, body: string): string {
  return body ? `## ${title}\n${body}` : "";
}

export const OBSERVATION_PRINCIPLES = `
Core principles (non-negotiable):
- Collect intensely; report lightly. Stage 1 records observations; it never diagnoses why.
- Observation is not diagnosis. A missed mark, low volume or poor conversion is evidence, not a root cause.
- BMCR (marks the student believed they knew or could have obtained) is separate from Direct/Indirect/Thinking (proximity to case evidence). Never merge them.
- Candidate response order is non-authoritative; required labels are authoritative. Identify (a), (b), (c)... by what the candidate wrote, not by page position.
- Report uncertainty rather than guessing. A "?" is a legitimate answer.
- Never infer mindset or psychology from a single script.
`.trim();

/** Methodology for Stage 1 (measurement). Observation only. */
export function stage1Methodology(): string {
  return [
    OBSERVATION_PRINCIPLES,
    block("Evaluator architecture", doc("evaluator-architecture")),
    block("Working principles", doc("working-principles")),
    block("BMCR", doc("bmcr")),
    block("Buried Treasure / Proximity", doc("buried-treasure-proximity")),
    block("Volume and Accuracy", doc("volume-and-accuracy")),
    block("Components", doc("components")),
    block("Core Issue", doc("core-issue")),
    block("RTFQ", doc("rtfq")),
    block("Question Type and Competency", doc("question-type-and-competency")),
    block("Communication", doc("communication")),
    block("Not attempted rule", doc("not-attempted")),
    block("Worked calibration — June 2026 Paper 1", doc("june-2026-paper-1-existing-locks")),
    block("Worked calibration — June 2026 Paper 2 Part II(c)", doc("june-2026-paper-2-part-ii-c")),
    block("Open questions (do not resolve silently)", doc("open-questions")),
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Eve's thinking, for Stage 2 (interpretation and reporting). */
export function stage2Methodology(): string {
  const ruleText = ruleDocs
    .filter((item) => item.id !== "starter-mapping")
    .map((item) => `### ${item.title}\n${item.content.trim()}`)
    .join("\n\n");
  const mapping = ruleDocs.find((item) => item.id === "starter-mapping")?.content.trim() || "";
  return [
    OBSERVATION_PRINCIPLES,
    block("Evaluator architecture", doc("evaluator-architecture")),
    block("Working principles", doc("working-principles")),
    block("Eve rules (confirmed by the coach)", ruleText),
    block("Starter mapping: tool/step → chain link → expected resistance → student-facing frame → evidence", mapping),
  ]
    .filter(Boolean)
    .join("\n\n");
}
