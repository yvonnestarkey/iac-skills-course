"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AssignmentsTab from "@/components/coach/AssignmentsTab";
import RosterTab from "@/components/coach/RosterTab";
import SurveysTab from "@/components/coach/SurveysTab";
import { labelForGroup } from "@/lib/comms";
import { cohortName, unansweredQuestion } from "@/lib/course";
import { averageSurveyScore, cohortCompletion, cohortStudents, pendingSubmissions } from "@/lib/metrics";
import { fetchRosterStudents, mergeRoster } from "@/lib/profiles";
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

  useEffect(() => {
    fetchRosterStudents().then((result) => {
      if (!result.ok) {
        setRosterNotice(result.error || "Could not load registered students.");
        return;
      }
      setLiveStudents(result.students);
    });
  }, []);

  const students = useMemo(
    () => cohortStudents({ ...data, students: mergeRoster(data.students, liveStudents) }, coach.cohort),
    [data, liveStudents, coach.cohort]
  );
  const active = students.filter((s) => s.status !== "paused");
  const completion = cohortCompletion(data, students);
  const avgSurvey = averageSurveyScore(data, students);
  const waiting = students.filter((s) => unansweredQuestion(data, s.id));
  const openProfile = (id: string) => router.push(`/coach/students/${id}`);

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
      <div className="stats">
        <div className="stat">
          <b>{completion}%</b>
          <span>Cohort completion</span>
          <div className="stat-bar">
            <span style={{ width: `${completion}%` }} />
          </div>
        </div>
        <div className="stat">
          <b>{active.length}</b>
          <span>
            Active students
            {students.length - active.length ? ` · ${students.length - active.length} paused` : ""}
          </span>
        </div>
        <div className="stat">
          <b>{pendingSubmissions(data, students)}</b>
          <span>Pending submissions</span>
        </div>
        <div className="stat">
          <b>{avgSurvey === null ? "—" : `${avgSurvey.toFixed(1)} / 5`}</b>
          <span>Average survey score</span>
        </div>
      </div>
      {waiting.length ? (
        <div className="dash-alert">
          {waiting.length} student{waiting.length === 1 ? "" : "s"} waiting on a reply:{" "}
          {waiting.map((s, i) => (
            <span key={s.id}>
              {i ? ", " : ""}
              <button className="link-btn" onClick={() => openProfile(s.id)}>
                {s.name}
              </button>
            </span>
          ))}
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
        <RosterTab students={students} onOpenProfile={openProfile} />
      ) : (
        <AssignmentsTab students={students} onOpenProfile={openProfile} />
      )}
    </div>
  );
}
