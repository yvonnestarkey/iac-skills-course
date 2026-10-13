"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AskCoachThread from "@/components/coach/AskCoachThread";
import { fetchRosterStudent } from "@/lib/profiles";
import type { Student } from "@/lib/types";

export default function StudentMessagesPage({ studentId }: { studentId: string }) {
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchRosterStudent(studentId).then((found) => {
      if (cancelled) return;
      setStudent(found);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (!ready) {
    return (
      <div className="coach-page">
        <button className="back-link" type="button" onClick={() => router.push(`/coach/students/${studentId}`)}>
          ← Back to profile
        </button>
        <p className="empty">Loading messages…</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="coach-page">
        <button className="back-link" type="button" onClick={() => router.push("/coach/lists")}>
          ← Back to dashboard
        </button>
        <p className="empty">No such student.</p>
      </div>
    );
  }

  return (
    <div className="coach-page">
      <button className="back-link" type="button" onClick={() => router.push(`/coach/students/${student.id}`)}>
        ← Back to {student.name.split(" ")[0]}&apos;s profile
      </button>
      <p className="kicker">Messages</p>
      <h1>{student.name}</h1>
      <AskCoachThread student={student} />
    </div>
  );
}
