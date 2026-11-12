"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  CreditCard,
  Inbox,
  LayoutGrid,
  Library,
  Mail,
  Megaphone,
  PenLine,
  Sparkles,
  UserPlus,
  UserRound,
  Users,
  Video,
  Wallet,
} from "lucide-react";
import {
  COACH_DASHBOARD_GROUPS,
  COACH_MARKING_PREVIEW,
  coachDashboardGreeting,
  coachMarkingItems,
  coachStudentCounts,
  type CoachDashTool,
  type CoachMarkingItem,
} from "@/lib/coach-dashboard";
import { fetchAllSurveySubmissions } from "@/lib/custom-surveys";
import { formatSastDateTime } from "@/lib/dates";
import { publicCatalogUrl } from "@/lib/lms-hosts";
import { fetchRosterStudents } from "@/lib/profiles";
import { fetchLessonSubmissionsForCoach } from "@/lib/student-submissions";
import { useStore } from "@/lib/store";

const TOOL_ICONS: Record<string, LucideIcon> = {
  lists: ClipboardList,
  "add-student": UserPlus,
  inbox: Inbox,
  surveys: ClipboardList,
  "student-course": BookOpen,
  catalog: Library,
  "dashboard-posts": Megaphone,
  builder: PenLine,
  tools: LayoutGrid,
  drips: Mail,
  fireflies: Video,
  account: UserRound,
  evaluator: Sparkles,
  bmcr: BarChart3,
  eve: Sparkles,
  commerce: CreditCard,
  revenue: Wallet,
  referrals: Users,
};

export default function CoachHomeDashboard() {
  const { data, setCoach } = useStore();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [counts, setCounts] = useState(coachStudentCounts([]));
  const [marking, setMarking] = useState<CoachMarkingItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchRosterStudents(), fetchLessonSubmissionsForCoach(), fetchAllSurveySubmissions()]).then(
      ([roster, lessons, surveys]) => {
        if (cancelled) return;
        setCounts(coachStudentCounts(roster.ok ? roster.students : []));
        setMarking(coachMarkingItems([...(lessons.ok ? lessons.data : []), ...(surveys.ok ? surveys.data : [])]));
        setReady(true);
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const greeting = useMemo(() => coachDashboardGreeting(), []);
  const preview = marking.slice(0, COACH_MARKING_PREVIEW);
  const extra = Math.max(0, marking.length - preview.length);

  const go = (item: CoachDashTool) => {
    if (item.tab) setCoach({ tab: item.tab });
    if (item.catalog) {
      const host = typeof window === "undefined" ? "" : window.location.hostname;
      const local = host === "localhost" || host === "127.0.0.1";
      router.push(local ? item.href : publicCatalogUrl());
      return;
    }
    router.push(item.href);
  };

  const openLists = (tab?: "assignments" | "roster" | "bmcr") => {
    if (tab) setCoach({ tab });
    router.push("/coach/lists");
  };

  return (
    <div className="coach-page coach-dash">
      <header className="coach-dash-head">
        <p className="kicker">Coach tools</p>
        <h1>{greeting}</h1>
        <p className="muted">
          {data.className} · {data.term}
        </p>
      </header>

      <div className="coach-dash-stats">
        <button type="button" className="coach-dash-stat is-paid" onClick={() => openLists("roster")}>
          <span className="kicker">Paid students</span>
          <b>{ready ? counts.paid : "—"}</b>
          <span className="muted small">Full course access</span>
        </button>
        <button type="button" className="coach-dash-stat is-free" onClick={() => openLists("roster")}>
          <span className="kicker">Free students</span>
          <b>{ready ? counts.free : "—"}</b>
          <span className="muted small">Preview access</span>
        </button>
        <button
          type="button"
          className={`coach-dash-stat is-mark${marking.length ? " has-work" : ""}`}
          onClick={() => openLists("assignments")}
        >
          <span className="kicker">To mark</span>
          <b>{ready ? marking.length : "—"}</b>
          <span className="muted small">Assignments waiting for you</span>
        </button>
      </div>

      <section className="card coach-dash-queue">
        <div className="coach-dash-queue-head">
          <div>
            <p className="kicker">Marking</p>
            <h2>Assignments to mark</h2>
          </div>
          <button type="button" className="ghost" onClick={() => openLists("assignments")}>
            Open submissions
          </button>
        </div>
        {!ready ? (
          <p className="empty">Checking the queue…</p>
        ) : preview.length ? (
          <ul className="coach-dash-queue-list">
            {preview.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => router.push(item.href)}>
                  <strong>{item.studentName}</strong>
                  <span>{item.title}</span>
                  <em>{formatSastDateTime(item.createdAt) || "Open"}</em>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">Nothing waiting — you are clear.</p>
        )}
        {extra ? (
          <p className="muted small">
            <button type="button" className="link-btn" onClick={() => openLists("assignments")}>
              {extra} more in the submissions queue
            </button>
          </p>
        ) : null}
      </section>

      <div className="coach-dash-grid">
        {COACH_DASHBOARD_GROUPS.map((group) => (
          <section key={group.id} className="coach-dash-col">
            <h2>{group.title}</h2>
            <p className="muted small">{group.blurb}</p>
            <div className="coach-dash-tiles">
              {group.items.map((item) => {
                const Icon = TOOL_ICONS[item.id] || LayoutGrid;
                return (
                  <button key={item.id} type="button" className="coach-dash-tile" onClick={() => go(item)}>
                    <span className="coach-dash-tile-icon" aria-hidden="true">
                      <Icon size={18} />
                    </span>
                    <span>
                      <strong>{item.title}</strong>
                      <span className="muted">{item.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
