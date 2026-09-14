"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AuditThread from "@/components/comms/AuditThread";
import { commsOf, labelForGroup } from "@/lib/comms";
import { cohortName } from "@/lib/course";
import { cohortStudents } from "@/lib/metrics";
import { fetchRosterStudents, mergeRoster } from "@/lib/profiles";
import { useStore } from "@/lib/store";
import type { CommunicationAudience, Student } from "@/lib/types";

export default function CoachNotificationsPage() {
  const { data, coach, setNotifyDraft } = useStore();
  const router = useRouter();
  const [audience, setAudience] = useState<CommunicationAudience>("cohort");
  const [liveStudents, setLiveStudents] = useState<Student[]>([]);
  const students = useMemo(() => mergeRoster(data.students, liveStudents), [data.students, liveStudents]);
  const [studentId, setStudentId] = useState("");
  const active = students.filter((student) => student.status !== "paused");

  useEffect(() => {
    fetchRosterStudents().then((result) => {
      if (result.ok) setLiveStudents(result.students);
    });
  }, []);

  useEffect(() => {
    if (!studentId && students[0]) setStudentId(students[0].id);
  }, [studentId, students]);

  const comms = commsOf(data);
  const cohort = cohortStudents({ ...data, students }, coach.cohort);
  const picked = students.find((s) => s.id === studentId);

  const start = () => {
    if (audience === "student" && picked) {
      setNotifyDraft({
        audience: "student",
        audienceLabel: picked.name,
        recipientIds: [picked.id],
      });
      return;
    }
    if (audience === "all") {
      setNotifyDraft({
        audience: "all",
        audienceLabel: labelForGroup(data, active, "all"),
        recipientIds: active.map((s) => s.id),
      });
      return;
    }
    setNotifyDraft({
      audience: "cohort",
      audienceLabel: labelForGroup(data, cohort, "cohort"),
      recipientIds: cohort.map((s) => s.id),
    });
  };

  return (
    <div className="coach-page">
      <button className="back-link" onClick={() => router.push("/coach")}>
        ← Coach home
      </button>
      <div className="coach-head">
        <div>
          <h1>Notifications</h1>
          <p className="muted">Announcements and replies, kept as a communications audit trail.</p>
        </div>
      </div>

      <section className="card">
        <div className="panel-head">
          <div>
            <h2>New announcement</h2>
            <p className="muted small">Send to one student, the current cohort filter, or everyone.</p>
          </div>
        </div>
        <div className="notify-send-row">
          <label className="role-chip">
            Send to
            <select value={audience} onChange={(event) => setAudience(event.target.value as CommunicationAudience)}>
              <option value="cohort">
                Cohort · {coach.cohort === "all" ? "All cohorts" : cohortName(data, coach.cohort)}
              </option>
              <option value="student">One student</option>
              <option value="all">All students</option>
            </select>
          </label>
          {audience === "student" ? (
            <label className="role-chip">
              Student
              <select value={studentId} onChange={(event) => setStudentId(event.target.value)}>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button className="primary" onClick={start}>
            Write notification
          </button>
        </div>
      </section>

      <section className="card">
        <div className="panel-head">
          <div>
            <h2>Communications</h2>
            <p className="muted small">
              {comms.length} thread{comms.length === 1 ? "" : "s"} · newest first
            </p>
          </div>
        </div>
        <div className="work-list">
          {comms.length ? (
            comms.map((comm) => <AuditThread key={comm.id} comm={comm} readerId="coach" readerRole="coach" />)
          ) : (
            <p className="empty">No announcements yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
