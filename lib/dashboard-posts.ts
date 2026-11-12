import { formatSastDateTime } from "./dates";
import { getSupabase } from "./supabase";

export const DASHBOARD_POSTS_SQL_HINT =
  "Paste supabase/dashboard-posts.sql in the Supabase SQL editor, then try again.";

export const DASHBOARD_POST_KINDS = ["announcement", "slide"] as const;
export const DASHBOARD_POST_STATUSES = ["draft", "published", "archived"] as const;

export type DashboardPostKind = (typeof DASHBOARD_POST_KINDS)[number];
export type DashboardPostStatus = (typeof DASHBOARD_POST_STATUSES)[number];

export type DashboardPost = {
  id: string;
  kind: DashboardPostKind;
  title: string;
  body: string;
  videoUrl: string;
  status: DashboardPostStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DashboardPostWrite = {
  id?: string;
  kind: DashboardPostKind;
  title: string;
  body: string;
  videoUrl: string;
  status: DashboardPostStatus;
};

export function isDashboardPostKind(value: unknown): value is DashboardPostKind {
  return DASHBOARD_POST_KINDS.includes(value as DashboardPostKind);
}

export function isDashboardPostStatus(value: unknown): value is DashboardPostStatus {
  return DASHBOARD_POST_STATUSES.includes(value as DashboardPostStatus);
}

export function emptyDashboardPostWrite(kind: DashboardPostKind): DashboardPostWrite {
  return { kind, title: "", body: "", videoUrl: "", status: "draft" };
}

export function dashboardPostToWrite(post: DashboardPost): DashboardPostWrite {
  return {
    id: post.id,
    kind: post.kind,
    title: post.title,
    body: post.body,
    videoUrl: post.videoUrl,
    status: post.status,
  };
}

export function dashboardPostKindLabel(kind: DashboardPostKind): string {
  return kind === "slide" ? "Login slide-in" : "Banner announcement";
}

export function dashboardPostStatusLabel(status: DashboardPostStatus): string {
  if (status === "published") return "Live";
  if (status === "archived") return "Previous";
  return "Draft";
}

export function slideDismissKey(postId: string, userId = ""): string {
  return `iac-dashboard-slide:${userId || "anon"}:${postId}`;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function tableMissing(message: string): boolean {
  return /dashboard_posts|does not exist|schema cache|could not find/i.test(message);
}

function postError(message: string): string {
  if (tableMissing(message) || /row-level security|not allowed|policy|unauthorized|403/i.test(message)) {
    return DASHBOARD_POSTS_SQL_HINT;
  }
  return message || "Could not update that dashboard post.";
}

export function postFromRow(row: Record<string, unknown>): DashboardPost {
  const status = isDashboardPostStatus(row.status) ? row.status : "draft";
  return {
    id: String(row.id),
    kind: isDashboardPostKind(row.kind) ? row.kind : "announcement",
    title: asText(row.title),
    body: asText(row.body),
    videoUrl: asText(row.video_url),
    status,
    publishedAt: asText(row.published_at) || null,
    createdAt: asText(row.created_at),
    updatedAt: asText(row.updated_at),
  };
}

export function dashboardPostWriteRow(
  input: DashboardPostWrite
): { ok: true; row: Record<string, unknown> } | { ok: false; error: string } {
  if (!isDashboardPostKind(input.kind)) return { ok: false, error: "Choose announcement or slide-in." };
  const title = input.title.trim();
  const body = input.body.trim();
  const videoUrl = input.videoUrl.trim();
  if (!title && !body && (input.kind === "announcement" || !videoUrl)) {
    return { ok: false, error: "Add a title, message, or video." };
  }
  const status = isDashboardPostStatus(input.status) ? input.status : "draft";
  const row: Record<string, unknown> = {
    kind: input.kind,
    title,
    body,
    video_url: videoUrl || null,
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "published") row.published_at = new Date().toISOString();
  return { ok: true, row };
}

export function currentPublishedPost(posts: DashboardPost[], kind: DashboardPostKind): DashboardPost | null {
  return (
    posts
      .filter((post) => post.kind === kind && post.status === "published")
      .sort((a, b) => String(b.publishedAt || b.updatedAt).localeCompare(String(a.publishedAt || a.updatedAt)))[0] || null
  );
}

export function formatDashboardPostWhen(post: DashboardPost): string {
  return formatSastDateTime(post.publishedAt || post.updatedAt || post.createdAt) || "";
}

async function listPosts(kind?: DashboardPostKind, publishedOnly = false): Promise<{ ok: boolean; error?: string; posts: DashboardPost[] }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured.", posts: [] };
  let query = client.from("dashboard_posts").select("*");
  if (kind) query = query.eq("kind", kind);
  if (publishedOnly) query = query.eq("status", "published").order("published_at", { ascending: false }).limit(1);
  else query = query.order("updated_at", { ascending: false });
  const { data, error } = await query;
  if (error) return { ok: false, error: postError(error.message), posts: [] };
  return { ok: true, posts: ((data || []) as Record<string, unknown>[]).map(postFromRow) };
}

export async function listDashboardPosts(kind?: DashboardPostKind): Promise<{ ok: boolean; error?: string; posts: DashboardPost[] }> {
  return listPosts(kind, false);
}

export async function fetchPublishedDashboardPost(kind: DashboardPostKind): Promise<DashboardPost | null> {
  const listed = await listPosts(kind, true);
  return listed.posts[0] || null;
}

export async function saveDashboardPost(
  input: DashboardPostWrite
): Promise<{ ok: true; post: DashboardPost } | { ok: false; error: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const built = dashboardPostWriteRow(input);
  if (built.ok === false) return built;
  const { data: session } = await client.auth.getUser();
  const row = { ...built.row, created_by: session.user?.id || null };
  if (input.status === "published") {
    await client
      .from("dashboard_posts")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("kind", input.kind)
      .eq("status", "published")
      .neq("id", input.id || "00000000-0000-0000-0000-000000000000");
  }
  const query = input.id
    ? client.from("dashboard_posts").update(row).eq("id", input.id).select("*").maybeSingle()
    : client.from("dashboard_posts").insert(row).select("*").maybeSingle();
  const { data, error } = await query;
  if (error || !data) return { ok: false, error: postError(error?.message || "Could not save that post.") };
  return { ok: true, post: postFromRow(data as Record<string, unknown>) };
}

export async function deleteDashboardPost(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { error } = await client.from("dashboard_posts").delete().eq("id", id);
  if (error) return { ok: false, error: postError(error.message) };
  return { ok: true };
}
