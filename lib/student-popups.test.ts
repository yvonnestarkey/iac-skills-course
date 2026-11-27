import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  activityIsDone,
  commitmentFollowThrough,
  dismissalsWithSkip,
  isPopupDismissed,
  pickMatchingPopup,
  popupMatchesFilters,
  skipIdsFromQuery,
  visiblePopupItems,
  type PopupContext,
  type PopupItem,
} from "./student-popups";

const ctx = (overrides: Partial<PopupContext> = {}): PopupContext => ({
  courseAccess: "full",
  onboarding: "completed",
  hasStudyPlan: false,
  journalThisWeek: false,
  journalNeed: "",
  scriptEval: "not_started",
  coaching: "none",
  completedLessonIds: [],
  ...overrides,
});

test("pop-up filters can target script eval, journal need, and skipped onboarding", () => {
  const filters = [
    { id: "1", field: "scriptEval" as const, operator: "is" as const, value: "not_started" },
    { id: "2", field: "journalNeed" as const, operator: "is" as const, value: "reality_check" },
  ];
  assert.equal(popupMatchesFilters(filters, "and", ctx({ journalNeed: "reality_check" })), true);
  assert.equal(popupMatchesFilters(filters, "and", ctx({ scriptEval: "submitted", journalNeed: "reality_check" })), false);
  assert.equal(
    popupMatchesFilters(
      [{ id: "3", field: "onboarding", operator: "is", value: "skipped" }],
      "and",
      ctx({ onboarding: "skipped" })
    ),
    true
  );
});

test("completed activities drop out of the pop-up and submitted scripts count as done", () => {
  const items: PopupItem[] = [
    { id: "a", kind: "activity", activity: "script_eval", label: "Submit scripts" },
    { id: "b", kind: "activity", activity: "study_plan", label: "Make a plan" },
    { id: "c", kind: "commitment", label: "I will send this by Friday", deadline: "2026-11-20" },
  ];
  assert.equal(activityIsDone("script_eval", ctx({ scriptEval: "submitted" })), true);
  const visible = visiblePopupItems(items, ctx({ scriptEval: "submitted", hasStudyPlan: true }), []);
  assert.deepEqual(visible.map((item) => item.id), ["c"]);
});

test("dismissed forever pop-ups are skipped; today dismissals expire next day", () => {
  const posts = [
    { id: "old", createdAt: "2026-11-01T08:00:00.000Z", filters: [], filterLogic: "and" as const },
    { id: "fresh", createdAt: "2026-11-10T08:00:00.000Z", filters: [], filterLogic: "and" as const },
  ];
  assert.equal(
    pickMatchingPopup(posts, ctx(), [{ popupId: "old", mode: "forever", onDate: "2026-11-17" }], "2026-11-18")?.id,
    "fresh"
  );
  assert.equal(
    pickMatchingPopup(
      posts,
      ctx(),
      [
        { popupId: "old", mode: "forever", onDate: "2026-11-17" },
        { popupId: "fresh", mode: "today", onDate: "2026-11-18" },
      ],
      "2026-11-18"
    ),
    null
  );
  assert.equal(
    pickMatchingPopup(posts, ctx(), [{ popupId: "fresh", mode: "today", onDate: "2026-11-17" }], "2026-11-18")?.id,
    "old"
  );
});

test("dismiss for today is one calendar day, not one pop-up per missed day", () => {
  assert.equal(isPopupDismissed({ popupId: "p1", mode: "today", onDate: "2026-11-13" }, "2026-11-27"), false);
  assert.equal(isPopupDismissed({ popupId: "p1", mode: "today", onDate: "2026-11-27" }, "2026-11-27"), true);
  assert.deepEqual(skipIdsFromQuery("first,second"), ["first", "second"]);
  const skipped = dismissalsWithSkip([], ["first"], "2026-11-27");
  assert.equal(pickMatchingPopup([{ id: "first", filters: [], filterLogic: "and" }], ctx(), skipped)?.id, undefined);
});

test("matching pop-ups run in setup order and the next one is used after a dismiss", () => {
  const posts = [
    { id: "second", createdAt: "2026-11-12T08:00:00.000Z", filters: [], filterLogic: "and" as const },
    { id: "first", createdAt: "2026-11-01T08:00:00.000Z", filters: [], filterLogic: "and" as const },
    { id: "third", createdAt: "2026-11-18T08:00:00.000Z", filters: [], filterLogic: "and" as const },
  ];
  assert.equal(pickMatchingPopup(posts, ctx(), [])?.id, "first");
  assert.equal(
    pickMatchingPopup(posts, ctx(), [{ popupId: "first", mode: "forever", onDate: "2026-11-18" }])?.id,
    "second"
  );
  assert.equal(
    pickMatchingPopup(posts, ctx(), [], "2026-11-18", (post) => post.id === "first")?.id,
    "second"
  );
});

test("a ticked commitment follows through once the linked activity is done", () => {
  const item: PopupItem = {
    id: "c1",
    kind: "commitment",
    label: "I will submit my scripts",
    deadline: "2026-11-20",
    activity: "script_eval",
  };
  if (item.kind !== "commitment") return;
  assert.equal(commitmentFollowThrough(item, ctx({ scriptEval: "submitted" }), true, "2026-11-18"), "followed_through");
  assert.equal(commitmentFollowThrough(item, ctx(), true, "2026-11-18"), "open");
  assert.equal(commitmentFollowThrough(item, ctx(), true, "2026-11-21"), "missed");
});

test("login pop-up, coach editor, profile commitments, and SQL stay wired", () => {
  const slide = readFileSync(resolve("components/student/StudentDashboardSlide.tsx"), "utf8");
  const editor = readFileSync(resolve("components/coach/LoginPopupFields.tsx"), "utf8");
  const manager = readFileSync(resolve("components/coach/DashboardPostsManager.tsx"), "utf8");
  const account = readFileSync(resolve("components/student/StudentAccount.tsx"), "utf8");
  const profile = readFileSync(resolve("components/coach/StudentProfile.tsx"), "utf8");
  const api = readFileSync(resolve("app/api/student/popups/route.ts"), "utf8");
  const sql = readFileSync(resolve("supabase/student-popups.sql"), "utf8");
  const css = readFileSync(resolve("app/globals.css"), "utf8");
  const login = readFileSync(resolve("components/student/StudentLoginForm.tsx"), "utf8");
  const shell = readFileSync(resolve("components/student/StudentShell.tsx"), "utf8");
  assert.match(slide, /Your focus plan/);
  assert.match(slide, /Dismiss completely/);
  assert.match(slide, /setTimeout\(\(\) => void load\(\), 240\)/);
  assert.match(slide, /skipped\.current/);
  assert.match(api, /created_at/);
  assert.match(api, /skipIdsFromQuery/);
  assert.match(slide, /POPUP_BG/);
  assert.match(slide, /dash-slide-figure/);
  assert.doesNotMatch(slide, /POPUP_AVATAR/);
  assert.match(css, /filter: blur\(16px\)/);
  assert.match(css, /mask-image: radial-gradient/);
  assert.match(slide, /createPortal/);
  assert.match(slide, /document\.body/);
  assert.match(login, /router\.replace\(gate === "done" \? "\/student" : "\/onboarding"\)/);
  assert.match(shell, /router\.replace\("\/student"\)/);
  assert.doesNotMatch(slide, /ask-drawer-backdrop/);
  assert.match(css, /z-index: 80/);
  assert.match(editor, /Add filter/);
  assert.match(editor, /Add commitment/);
  assert.match(manager, /student-popups.sql/);
  assert.match(account, /StudentCommitments/);
  assert.match(profile, /StudentCommitments/);
  assert.match(api, /action === "dismiss"/);
  assert.match(sql, /student_popup_responses/);
  assert.match(css, /max-width: 50%/);
  assert.match(css, /66\.666vh/);
});
