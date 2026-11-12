import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  currentPublishedPost,
  dashboardPostKindLabel,
  dashboardPostStatusLabel,
  dashboardPostWriteRow,
  emptyDashboardPostWrite,
  postFromRow,
  slideDismissKey,
  type DashboardPost,
} from "./dashboard-posts";

function post(overrides: Partial<DashboardPost> = {}): DashboardPost {
  return {
    id: "p1",
    kind: "announcement",
    title: "This week",
    body: "Study clinic Thursday.",
    videoUrl: "",
    status: "published",
    publishedAt: "2026-11-10T08:00:00.000Z",
    createdAt: "2026-11-09T08:00:00.000Z",
    updatedAt: "2026-11-10T08:00:00.000Z",
    ...overrides,
  };
}

test("announcement writes need a title or message; slides can be video only", () => {
  assert.equal(dashboardPostWriteRow(emptyDashboardPostWrite("announcement")).ok, false);
  const announcement = dashboardPostWriteRow({
    ...emptyDashboardPostWrite("announcement"),
    title: "Exam week",
    body: "Bring your BMCR.",
    status: "published",
  });
  assert.equal(announcement.ok, true);
  if (!announcement.ok) return;
  assert.equal(announcement.row.kind, "announcement");
  assert.equal(announcement.row.status, "published");
  assert.equal(typeof announcement.row.published_at, "string");

  const slideVideo = dashboardPostWriteRow({
    ...emptyDashboardPostWrite("slide"),
    videoUrl: "https://vimeo.com/123",
    status: "draft",
  });
  assert.equal(slideVideo.ok, true);
  if (!slideVideo.ok) return;
  assert.equal(slideVideo.row.video_url, "https://vimeo.com/123");
  assert.equal(slideVideo.row.published_at, undefined);
});

test("the newest published post of a kind is the live one", () => {
  const live = currentPublishedPost(
    [
      post({ id: "old", publishedAt: "2026-11-01T08:00:00.000Z" }),
      post({ id: "draft", status: "draft", publishedAt: null }),
      post({ id: "fresh", publishedAt: "2026-11-11T08:00:00.000Z" }),
      post({ id: "slide", kind: "slide", publishedAt: "2026-11-12T08:00:00.000Z" }),
    ],
    "announcement"
  );
  assert.equal(live?.id, "fresh");
  assert.equal(dashboardPostKindLabel("slide"), "Login slide-in");
  assert.equal(dashboardPostStatusLabel("archived"), "Previous");
});

test("slide dismiss keys are per student and post", () => {
  assert.equal(slideDismissKey("post-1", "user-1"), "iac-dashboard-slide:user-1:post-1");
  assert.equal(slideDismissKey("post-1"), "iac-dashboard-slide:anon:post-1");
});

test("rows map snake_case columns onto the dashboard post", () => {
  const mapped = postFromRow({
    id: "row-1",
    kind: "slide",
    title: "Watch this",
    body: "Five minutes.",
    video_url: "https://youtu.be/abc",
    status: "archived",
    published_at: "2026-11-02T08:00:00.000Z",
    created_at: "2026-11-01T08:00:00.000Z",
    updated_at: "2026-11-02T08:00:00.000Z",
  });
  assert.equal(mapped.kind, "slide");
  assert.equal(mapped.videoUrl, "https://youtu.be/abc");
  assert.equal(mapped.status, "archived");
  assert.equal(mapped.publishedAt, "2026-11-02T08:00:00.000Z");
});

test("banner announcements, quote card, login slide, and coach tools stay wired", () => {
  const banner = readFileSync(resolve("components/student/StudentDashboardBanner.tsx"), "utf8");
  const dashboard = readFileSync(resolve("components/student/StudentDashboard.tsx"), "utf8");
  const quote = readFileSync(resolve("components/student/StudentDashboardQuote.tsx"), "utf8");
  const slide = readFileSync(resolve("components/student/StudentDashboardSlide.tsx"), "utf8");
  const manager = readFileSync(resolve("components/coach/DashboardPostsManager.tsx"), "utf8");
  const page = readFileSync(resolve("app/coach/dashboard-posts/page.tsx"), "utf8");
  const home =
    readFileSync(resolve("app/coach/page.tsx"), "utf8") +
    readFileSync(resolve("lib/coach-dashboard.ts"), "utf8") +
    readFileSync(resolve("components/coach/CoachHomeDashboard.tsx"), "utf8");
  const tools = readFileSync(resolve("lib/course-tools.ts"), "utf8");
  const sql = readFileSync(resolve("supabase/dashboard-posts.sql"), "utf8");

  assert.doesNotMatch(banner, /dashboardQuoteForDate/);
  assert.match(banner, /fetchPublishedDashboardPost\("announcement"\)/);
  assert.match(banner, /Announcement/);
  assert.match(dashboard, /StudentDashboardQuote/);
  assert.match(dashboard, /StudentDashboardSlide/);
  assert.match(quote, /dashboardQuoteForDate/);
  assert.match(quote, /dashboard-quote-card/);
  assert.match(slide, /ask-drawer/);
  assert.match(slide, /fetchPublishedDashboardPost\("slide"\)/);
  assert.match(slide, /slideDismissKey/);
  assert.match(manager, /Previous posts/);
  assert.match(manager, /KindEditor kind="announcement"/);
  assert.match(manager, /KindEditor kind="slide"/);
  assert.match(page, /DashboardPostsManager/);
  assert.match(home, /\/coach\/dashboard-posts/);
  assert.match(tools, /id: "dashboard-posts"/);
  assert.match(sql, /create table if not exists public\.dashboard_posts/);
  assert.match(sql, /kind in \('announcement', 'slide'\)/);
});
