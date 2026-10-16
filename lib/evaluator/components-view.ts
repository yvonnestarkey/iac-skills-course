/**
 * Component rows for Step 4 of the per-paper report. A "component" is one entry of the question model's core_marks
 * (the unit that carries marks and decides the core issue). Its evidence comes from the tree nodes that belong to it.
 */
import { coreComponents, questionModelFor } from "./question-model";
import type { ComponentNodeEvidence, RequirementEvaluation } from "./types";

export type ComponentRow = {
  label: string;
  /** Layer headings above the component (for display), outermost first. */
  layers: string[];
  marks_available: number;
  marks_earned: number | null;
  recognised: "yes" | "partly" | "no";
  exploited: "yes" | "partly" | "no";
  core: boolean;
  /** Only for core components. */
  core_recognised: "yes" | "partly" | "no" | null;
};

/** Which keys a node can be known by: most specific first. */
function nodeKeys(node: ComponentNodeEvidence): string[] {
  const p = node.path;
  return [p.join(" > "), p.join(": "), p[p.length - 1], p[0], node.label];
}

const triState = (hit: number, of: number): "yes" | "partly" | "no" => (of === 0 || hit === 0 ? "no" : hit === of ? "yes" : "partly");

export function componentRows(paperId: string, req: RequirementEvaluation): ComponentRow[] | null {
  const model = questionModelFor(paperId, req.code);
  const core = coreComponents(model);
  const nodes = (req.components?.nodes ?? []).filter((n) => n.basic_theory);
  if (!core || !nodes.length) return null;
  const labels = new Set(core.map((c) => c.label));
  // each node belongs to the first of its keys that names a component
  const owner = new Map<string, ComponentNodeEvidence[]>();
  for (const node of nodes) {
    const key = nodeKeys(node).find((k) => labels.has(k));
    if (key) owner.set(key, [...(owner.get(key) ?? []), node]);
  }
  return core.map((c) => {
    const own = owner.get(c.label) ?? [];
    const rec = own.filter((n) => n.recognised).length;
    const exp = own.filter((n) => n.exploited).length;
    const awarded = own.some((n) => typeof n.marks_awarded === "number") ? own.reduce((s, n) => s + (n.marks_awarded ?? 0), 0) : null;
    const recognised = triState(rec, own.length);
    // "A > B" and "Layer: item" (where Layer is the first path element of the tree) split into layers; other labels stay whole.
    const top = own[0]?.path[0];
    const parts = c.label.includes(" > ") ? c.label.split(" > ") : top && own[0].path.length >= 2 && c.label.startsWith(`${top}: `) ? [top, c.label.slice(top.length + 2)] : [c.label];
    return {
      label: parts[parts.length - 1],
      layers: parts.slice(0, -1),
      marks_available: c.marks,
      marks_earned: awarded,
      recognised,
      exploited: triState(exp, own.length),
      core: c.core,
      core_recognised: c.core ? recognised : null,
    };
  });
}

/** Core components that were not looked at at all (the Components and Core Issue signal). */
export function coreNotReached(paperId: string, req: RequirementEvaluation): boolean | null {
  const rows = componentRows(paperId, req);
  if (!rows) return null;
  const core = rows.filter((r) => r.core);
  if (!core.length) return null;
  return core.some((r) => r.core_recognised === "no");
}
