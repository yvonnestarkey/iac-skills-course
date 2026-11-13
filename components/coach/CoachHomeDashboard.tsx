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
import CoachJournalNeeds from "@/components/coach/CoachJournalNeeds";
import CoachReminders from "@/components/coach/CoachReminders";
import CoachScheduledSends from "@/components/coach/CoachScheduledSends";
import StudentProfileLink from "@/components/coach/StudentProfileLink";
import {
  COACH_DASHBOARD_GROUPS,
  coachDashboardGreeting,
  coachMarkingItems,
  coachStudentCounts,
  coachWatchStudents,
  fetchAwaitingEvaluatorReports,
  fetchLastHeardByStudent,
  type CoachDashTool,
  type CoachWatchKind,
  type CoachWatchStudent,
} from "@/lib/coach-dashboard";
import { lastActiveLabel } from "@/lib/course";
import { fetchAllSurveySubmissions } from "@/lib/custom-surveys";
import { labelForGroup } from "@/lib/comms";
import { publicCatalogUrl } from "@/lib/lms-hosts";
import { fetchRosterStudents } from "@/lib/profiles";
import { fetchLessonSubmissionsForCoach } from "@/lib/student-submissions";
import { useStore } from "@/lib/store";
import type { Student } from "@/lib/types";

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
  const { data, setCoach, setNotifyDraft } = useStore();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [counts, setCounts] = useState(coachStudentCounts([]));
  const [marking, setMarking] = useState(0);
  const [reports, setReports] = useState(0);
  const [disengaged, setDisengaged] = useState<CoachWatchStudent[]>([]);
  const [quiet, setQuiet] = useState<CoachWatchStudent[]>([]);
  const [watch, setWatch] = useState<CoachWatchKind | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchRosterStudents(),
      fetchLessonSubmissionsForCoach(),
      fetchAllSurveySubmissions(),
      fetchAwaitingEvaluatorReports(),
    ]).then(async ([roster, lessons, surveys, awaitingReports]) => {
      if (cancelled) return;
      const live = roster.ok ? roster.students : [];
      const heard = await fetchLastHeardByStudent(live);
      if (cancelled) return;
      setStudents(live);
      setCounts(coachStudentCounts(live));
      setMarking(coachMarkingItems([...(lessons.ok ? lessons.data : []), ...(surveys.ok ? surveys.data : [])]).length);
      setReports(awaitingReports);
      setDisengaged(coachWatchStudents(live, "disengaged", heard));
      setQuiet(coachWatchStudents(live, "quiet", heard));
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const greeting = useMemo(() => coachDashboardGreeting(), []);
  const watchList = watch === "quiet" ? quiet : watch === "disengaged" ? disengaged : [];
  const watchLabel = watch === "quiet" ? "Quiet students" : "Disengaged students";

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

  const messageStudents = (ids: string[], label: string) => {
    const picked = students.filter((student) => ids.includes(student.id));
    if (!ids.length) return;
    setNotifyDraft({
      audience: ids.length === 1 ? "student" : "filtered",
      audienceLabel: picked.length ? labelForGroup(data, picked, ids.length === 1 ? "student" : "filtered", label) : label,
      recipientIds: ids,
    });
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
          className={`coach-dash-stat is-mark${marking ? " has-work" : ""}`}
          onClick={() => openLists("assignments")}
        >
          <span className="kicker">To mark</span>
          <b>{ready ? marking : "—"}</b>
          <span className="muted small">Assignments waiting for you</span>
        </button>
        <button
          type="button"
          className={`coach-dash-stat is-reports${reports ? " has-work" : ""}`}
          onClick={() => router.push("/coach/evaluator")}
        >
          <span className="kicker">Awaiting reports</span>
          <b>{ready ? reports : "—"}</b>
          <span className="muted small">Script evaluations to release</span>
        </button>
        <button
          type="button"
          className={`coach-dash-stat is-disengaged${disengaged.length ? " has-work" : ""}`}
          onClick={() => setWatch((current) => (current === "disengaged" ? null : "disengaged"))}
        >
          <span className="kicker">Disengaged</span>
          <b>{ready ? disengaged.length : "—"}</b>
          <span className="muted small">Paid students, no login in a week</span>
        </button>
        <button
          type="button"
          className={`coach-dash-stat is-quiet${quiet.length ? " has-work" : ""}`}
          onClick={() => setWatch((current) => (current === "quiet" ? null : "quiet"))}
        >
          <span className="kicker">Quiet</span>
          <b>{ready ? quiet.length : "—"}</b>
          <span className="muted small">Paid students logged in, not heard from you</span>
        </button>
      </div>

      {watch ? (
        <section className="card coach-dash-queue">
          <div className="coach-dash-queue-head">
            <div>
              <p className="kicker">Students</p>
              <h2>{watchLabel}</h2>
            </div>
            <div className="coach-dash-queue-actions">
              <button
                type="button"
                className="primary"
                disabled={!watchList.length}
                onClick={() => messageStudents(watchList.map((student) => student.id), watchLabel)}
              >
                Send a group message
              </button>
              <button type="button" className="ghost" onClick={() => setWatch(null)}>
                Close
              </button>
            </div>
          </div>
          {!ready ? (
            <p className="empty">Checking the roster…</p>
          ) : watchList.length ? (
            <ul className="coach-dash-watch-list">
              {watchList.map((student) => (
                <li key={student.id}>
                  <StudentProfileLink studentId={student.id}>{student.name}</StudentProfileLink>
                  <span className="muted small">
                    {watch === "disengaged"
                      ? student.lastActive
                        ? `Last in ${lastActiveLabel({ lastActive: student.lastActive })}`
                        : "Never logged in"
                      : "Active this week, no note from you in 7 days"}
                  </span>
                  <button type="button" className="link-btn" onClick={() => messageStudents([student.id], student.name)}>
                    Message
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">Nobody in this list right now.</p>
          )}
        </section>
      ) : null}

      <CoachJournalNeeds students={students} onMessage={messageStudents} />

      <CoachReminders students={students} onMessage={messageStudents} />

      <CoachScheduledSends />

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
