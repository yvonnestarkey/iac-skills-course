import { SEEDED_FEEDBACK_TEMPLATES } from "./feedback-templates-seed";
import { getSupabase } from "./supabase";

export const FEEDBACK_TEMPLATES_SQL =
  "Paste supabase/feedback-templates.sql in the Supabase SQL editor so you can save new canned responses. The built-in Task replies already work without it.";

export type FeedbackTemplate = {
  id: string;
  group: string;
  title: string;
  body: string;
  custom: boolean;
};

export const TEMPLATE_GROUPS = [
  "Task 1",
  "Task 2",
  "Task 3",
  "Task 3 DIY",
  "Task 4",
  "Task 5",
  "Task 5 Extra",
  "Task 6",
  "Task 2 (Old)",
  "Planning",
  "Grassroots",
  "Script review",
  "General",
] as const;

export function suggestedTemplateGroup(title: string | null | undefined): string {
  const text = String(title || "");
  if (/diy.*task\s*3|task\s*3.*diy/i.test(text)) return "Task 3 DIY";
  if (/task\s*5.*extra|extra.*task\s*5/i.test(text)) return "Task 5 Extra";
  if (/grassroots/i.test(text)) return "Grassroots";
  if (/script review/i.test(text)) return "Script review";
  if (/task\s*2.*old|old.*task\s*2/i.test(text)) return "Task 2 (Old)";
  if (/planning|rtfq|time management/i.test(text) && !/task\s*\d/i.test(text)) return "Planning";
  const task = text.match(/task\s*(\d+)/i);
  if (task) return `Task ${task[1]}`;
  return "Task 1";
}

export function templatesInGroup(templates: FeedbackTemplate[], group: string): FeedbackTemplate[] {
  return templates.filter((item) => item.group === group);
}

export function cannedResponseText(template: { title?: string; body?: string }): string {
  const title = String(template.title || "").trim();
  const body = String(template.body || "").trim();
  if (!title) return body;
  if (!body) return `**${title}**`;
  const firstLine = body
    .split("\n")[0]
    .replace(/^#+\s*/, "")
    .replace(/^\*\*(.+)\*\*$/, "$1")
    .trim();
  if (firstLine.toLowerCase() === title.toLowerCase()) return body;
  return `**${title}**\n\n${body}`;
}

export function applyCannedResponse(current: string, canned: string, mode: "replace" | "append"): string {
  const next = String(canned || "").trim();
  if (!next) return String(current || "");
  const existing = String(current || "").trim();
  if (!existing || mode === "replace") return next;
  return `${existing}\n\n${next}`;
}

function fromRow(row: Record<string, unknown>): FeedbackTemplate {
  return {
    id: String(row.id || ""),
    group: String(row.group_label || row.group || "General").trim() || "General",
    title: String(row.title || "Untitled").trim() || "Untitled",
    body: String(row.body || "").trim(),
    custom: true,
  };
}

export async function fetchFeedbackTemplates(): Promise<FeedbackTemplate[]> {
  const client = getSupabase();
  if (!client) return SEEDED_FEEDBACK_TEMPLATES;
  const { data, error } = await client.from("feedback_templates").select("*").order("created_at", { ascending: true });
  if (error || !data) return SEEDED_FEEDBACK_TEMPLATES;
  const custom = (data as Record<string, unknown>[]).map(fromRow).filter((item) => item.body);
  return [...SEEDED_FEEDBACK_TEMPLATES, ...custom];
}

export async function saveFeedbackTemplate(input: {
  group: string;
  title: string;
  body: string;
}): Promise<{ ok: boolean; error?: string; template?: FeedbackTemplate }> {
  const group = String(input.group || "").trim() || "General";
  const title = String(input.title || "").trim();
  const body = String(input.body || "").trim();
  if (!title) return { ok: false, error: "Give this canned response a short name." };
  if (!body) return { ok: false, error: "Write the canned response before saving it." };
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { data: session } = await client.auth.getUser();
  if (!session.user) return { ok: false, error: "Sign in required." };
  const { data, error } = await client
    .from("feedback_templates")
    .insert({
      group_label: group,
      title,
      body,
      created_by: session.user.id,
    })
    .select("*")
    .maybeSingle();
  if (error || !data) return { ok: false, error: error?.message || FEEDBACK_TEMPLATES_SQL };
  return { ok: true, template: fromRow(data as Record<string, unknown>) };
}

export async function deleteFeedbackTemplate(id: string): Promise<{ ok: boolean; error?: string }> {
  if (SEEDED_FEEDBACK_TEMPLATES.some((item) => item.id === id)) {
    return { ok: false, error: "Built-in canned responses stay in the list." };
  }
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { error } = await client.from("feedback_templates").delete().eq("id", id);
  if (error) return { ok: false, error: error.message || FEEDBACK_TEMPLATES_SQL };
  return { ok: true };
}
