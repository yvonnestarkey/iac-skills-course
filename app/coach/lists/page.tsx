"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AssignmentsTab from "@/components/coach/AssignmentsTab";
import RosterTab from "@/components/coach/RosterTab";
import SurveysTab from "@/components/coach/SurveysTab";
import { labelForGroup } from "@/lib/comms";
import { cohortName, unansweredQuestion } from "@/lib/course";
import { assignmentSubmissionsAwaitingFeedback, cohortStudents } from "@/lib/metrics";
import { fetchRosterStudents, mergeRoster } from "@/lib/profiles";
import { fetchSubmissionsAwaitingFeedback } from "@/lib/student-submissions";
import { useStore } from "@/lib/store";
import type { Student } from "@/lib/types";

const TABS = [
  { id: "assignments", label: "Assignments", href: null },
  { id: "surveys", label: "Module Surveys", href: null },
  { id: "roster", label: "Student Roster", href: null },
  { id: "inbox", label: "Inbox", href: "/coach/inbox" },
] as const;

export default function StudentListsPage() {
  const { data, coach, setCoach, setNotifyDraft, notice } = useStore();
  const router = useRouter();
  const [liveStudents, setLiveStudents] = useState<Student[]>([]);
  const [rosterNotice, setRosterNotice] = useState("");
  const [awaitingLive, setAwaitingLive] = useState<{ ready: boolean; rows: { studentId: string; lessonId: string }[] | null }>({
    ready: false,
    rows: null,
  });

  useEffect(() => {
    fetchRosterStudents().then((result) => {
      if (!result.ok) {
        setRosterNotice(result.error || "Could not load registered students.");
        return;
      }
      setLiveStudents(result.students);
    });
    fetchSubmissionsAwaitingFeedback().then((result) => {
      setAwaitingLive({ ready: true, rows: result.ok ? result.rows : null });
    });
  }, []);

  const roster = useMemo(() => mergeRoster(data.students, liveStudents), [data.students, liveStudents]);
  const students = useMemo(() => cohortStudents({ ...data, students: roster }, coach.cohort), [data, roster, coach.cohort]);
  const waiting = students.filter((s) => unansweredQuestion(data, s.id));
  const awaitingFeedback = awaitingLive.ready
    ? assignmentSubmissionsAwaitingFeedback(data, students, awaitingLive.rows)
    : { count: 0, students: [] };
  const openProfile = (id: string) => router.push(`/coach/students/${id}`);

  const nameLinks = (list: Student[]) =>
    list.map((s, i) => (
      <span key={s.id}>
        {i ? ", " : ""}
        <button className="link-btn" onClick={() => openProfile(s.id)}>
          {s.name}
        </button>
      </span>
    ));

  return (
    <div className="coach-page">
      <button className="back-link" onClick={() => router.push("/coach")}>
        ← Coach home
      </button>
      <div className="coach-head">
        <div>
          <h1>Student lists</h1>
          <p className="muted">
            {data.className} · {coach.cohort === "all" ? "all cohorts" : cohortName(data, coach.cohort)}
          </p>
        </div>
        <div className="actions">
          <button
            className="primary"
            onClick={() =>
              setNotifyDraft({
                audience: coach.cohort === "all" ? "all" : "cohort",
                audienceLabel: labelForGroup(data, students, coach.cohort === "all" ? "all" : "cohort"),
                recipientIds: students.map((s) => s.id),
              })
            }
            disabled={!students.length}
          >
            Notify this cohort ({students.length})
          </button>
          <label className="role-chip">
            Cohort
            <select id="cohort" value={coach.cohort} onChange={(event) => setCoach({ cohort: event.target.value })}>
            <option value="all">All cohorts</option>
            {(data.cohorts || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.current ? " (current)" : ""}
              </option>
            ))}
          </select>
          </label>
        </div>
      </div>
      {notice ? <div className="notice">{notice}</div> : null}
      {rosterNotice ? <div className="notice">{rosterNotice} Run the profiles SQL in Supabase if this table is new.</div> : null}
      {waiting.length || awaitingFeedback.count ? (
        <div className="dash-alerts">
          {waiting.length ? (
            <div className="dash-alert">
              {waiting.length} student{waiting.length === 1 ? "" : "s"} waiting on a reply: {nameLinks(waiting)}
            </div>
          ) : null}
          {awaitingFeedback.count ? (
            <div className="dash-alert">
              {awaitingFeedback.count} assignment submission{awaitingFeedback.count === 1 ? "" : "s"} awaiting
              feedback: {nameLinks(awaitingFeedback.students)}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${coach.tab === t.id ? "active" : ""}`}
            onClick={() => {
              if (t.href) {
                router.push(t.href);
                return;
              }
              setCoach({ tab: t.id as "assignments" | "surveys" | "roster" });
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {coach.tab === "surveys" ? (
        <SurveysTab students={students} onOpenProfile={openProfile} />
      ) : coach.tab === "roster" ? (
        <RosterTab students={students} optionStudents={roster} onOpenProfile={openProfile} />
      ) : (
        <AssignmentsTab students={students} onOpenProfile={openProfile} />
      )}
    </div>
  );
}
