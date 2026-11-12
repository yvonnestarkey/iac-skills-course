"use client";

import { useEffect, useState } from "react";
import RichTextField from "@/components/ui/RichTextField";
import {
  currentPublishedPost,
  dashboardPostKindLabel,
  dashboardPostStatusLabel,
  dashboardPostToWrite,
  deleteDashboardPost,
  emptyDashboardPostWrite,
  formatDashboardPostWhen,
  listDashboardPosts,
  saveDashboardPost,
  type DashboardPost,
  type DashboardPostKind,
  type DashboardPostWrite,
} from "@/lib/dashboard-posts";

function KindEditor({ kind }: { kind: DashboardPostKind }) {
  const [posts, setPosts] = useState<DashboardPost[]>([]);
  const [form, setForm] = useState<DashboardPostWrite>(emptyDashboardPostWrite(kind));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const load = async () => {
    const result = await listDashboardPosts(kind);
    setPosts(result.posts);
    setError(result.error || "");
    setReady(true);
  };

  useEffect(() => {
    void load();
  }, [kind]);

  const set = (next: Partial<DashboardPostWrite>) => setForm((current) => ({ ...current, ...next }));
  const live = currentPublishedPost(posts, kind);
  const previous = posts.filter((post) => post.id !== live?.id);

  const persist = async (status: DashboardPostWrite["status"]) => {
    setBusy(true);
    setError("");
    setNotice("");
    const result = await saveDashboardPost({ ...form, kind, status });
    setBusy(false);
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    setForm(emptyDashboardPostWrite(kind));
    setNotice(status === "published" ? "Live on the student dashboard." : "Draft saved.");
    await load();
  };

  const edit = (post: DashboardPost) => {
    setForm(dashboardPostToWrite(post));
    setNotice(`Editing “${post.title || dashboardPostKindLabel(kind)}”.`);
    setError("");
  };

  const publishExisting = async (post: DashboardPost) => {
    setBusy(true);
    const result = await saveDashboardPost({ ...dashboardPostToWrite(post), status: "published" });
    setBusy(false);
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    setNotice("That post is live again.");
    await load();
  };

  const archive = async (post: DashboardPost) => {
    setBusy(true);
    const result = await saveDashboardPost({ ...dashboardPostToWrite(post), status: "archived" });
    setBusy(false);
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    setNotice("Moved to previous posts.");
    await load();
  };

  const remove = async (post: DashboardPost) => {
    if (!window.confirm(`Remove “${post.title || "this post"}”?`)) return;
    setBusy(true);
    const result = await deleteDashboardPost(post.id);
    setBusy(false);
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    if (form.id === post.id) setForm(emptyDashboardPostWrite(kind));
    await load();
  };

  return (
    <section className="card">
      <h2>{dashboardPostKindLabel(kind)}</h2>
      <p className="muted small">
        {kind === "slide"
          ? "Slides in from the right when a student opens the dashboard. A new post shows until they close it."
          : "Shows in the dashboard banner, in the space the weekly quote used to occupy."}
      </p>
      {error ? <p className="waiting">{error}</p> : null}
      {notice ? <p className="muted">{notice}</p> : null}

      <label className="student-notes-label" htmlFor={`${kind}-title`}>
        Title
      </label>
      <input
        id={`${kind}-title`}
        className="select-line"
        type="text"
        value={form.title}
        onChange={(event) => set({ title: event.target.value })}
        placeholder={kind === "slide" ? "A quick pep talk" : "This week"}
        disabled={busy}
      />
      <label className="student-notes-label" htmlFor={`${kind}-body`}>
        Message
      </label>
      <RichTextField
        id={`${kind}-body`}
        rows={5}
        value={form.body}
        onChange={(body) => set({ body })}
        placeholder="Write the note students should see."
      />
      {kind === "slide" ? (
        <>
          <label className="student-notes-label" htmlFor={`${kind}-video`}>
            Video link (optional)
          </label>
          <input
            id={`${kind}-video`}
            className="select-line"
            type="url"
            value={form.videoUrl}
            onChange={(event) => set({ videoUrl: event.target.value })}
            placeholder="https://vimeo.com/… or YouTube"
            disabled={busy}
          />
        </>
      ) : null}
      <p className="coaching-actions">
        <button type="button" className="primary" disabled={busy} onClick={() => void persist("published")}>
          {busy ? "Saving…" : form.id ? "Publish changes" : "Publish"}
        </button>
        <button type="button" className="ghost" disabled={busy} onClick={() => void persist("draft")}>
          Save draft
        </button>
        {form.id ? (
          <button type="button" className="ghost" disabled={busy} onClick={() => setForm(emptyDashboardPostWrite(kind))}>
            New post
          </button>
        ) : null}
      </p>

      <h3>Live now</h3>
      {ready && live ? (
        <article className="work-item">
          <div className="work-head">
            <strong>{live.title || "Untitled"}</strong>
            <span className="muted small">{formatDashboardPostWhen(live)}</span>
          </div>
          <p className="muted small">{live.body.slice(0, 180) || live.videoUrl || "No body"}</p>
          <div className="actions">
            <button type="button" className="ghost" disabled={busy} onClick={() => edit(live)}>
              Edit
            </button>
            <button type="button" className="ghost" disabled={busy} onClick={() => void archive(live)}>
              Take down
            </button>
          </div>
        </article>
      ) : (
        <p className="empty">Nothing live yet.</p>
      )}

      <h3>Previous posts</h3>
      {previous.length ? (
        previous.map((post) => (
          <article className="work-item" key={post.id}>
            <div className="work-head">
              <strong>{post.title || "Untitled"}</strong>
              <span className="muted small">
                {dashboardPostStatusLabel(post.status)}
                {formatDashboardPostWhen(post) ? ` · ${formatDashboardPostWhen(post)}` : ""}
              </span>
            </div>
            <p className="muted small">{post.body.slice(0, 140) || post.videoUrl || ""}</p>
            <div className="actions">
              <button type="button" className="ghost" disabled={busy} onClick={() => edit(post)}>
                Edit
              </button>
              {post.status !== "published" ? (
                <button type="button" className="ghost" disabled={busy} onClick={() => void publishExisting(post)}>
                  Make live
                </button>
              ) : null}
              <button type="button" className="ghost" disabled={busy} onClick={() => void remove(post)}>
                Remove
              </button>
            </div>
          </article>
        ))
      ) : (
        <p className="empty">No earlier posts yet.</p>
      )}
    </section>
  );
}

export default function DashboardPostsManager() {
  return (
    <div className="dashboard-posts-manager">
      <p className="kicker">Student dashboard</p>
      <h1>Dashboard posts</h1>
      <p className="muted">
        Edit the banner announcement and the login slide-in. Previous posts stay here so you can bring one back.
      </p>
      <p className="muted small">
        Paste <code>supabase/dashboard-posts.sql</code> in Supabase before the first publish.
      </p>
      <KindEditor kind="announcement" />
      <KindEditor kind="slide" />
    </div>
  );
}
