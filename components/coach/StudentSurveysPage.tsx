"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStudentSurveyPacks, type StudentSurveyPack } from "@/lib/student-survey-packs";
import type { Student } from "@/lib/types";
import SurveyAnswerValue from "@/components/ui/SurveyAnswerValue";

export default function StudentSurveysPage({ studentId }: { studentId: string }) {
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [packs, setPacks] = useState<StudentSurveyPack[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadStudentSurveyPacks(studentId).then((result) => {
      if (cancelled) return;
      setStudent(result.student);
      setPacks(result.packs);
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
        <p className="empty">Loading surveys…</p>
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
      <section className="card">
        <div className="panel-head">
          <div>
            <p className="kicker">Surveys</p>
            <h1>{student.name}</h1>
            <p className="muted small">Onboarding details and background, then any later survey responses.</p>
          </div>
        </div>
        {packs.length ? (
          <div className="work-list">
            {packs.map((pack, index) => (
              <div className="work-item" key={`${pack.title}-${index}`}>
                <div className="work-head">
                  <strong>{pack.title}</strong>
                </div>
                {pack.answers.length ? (
                  pack.answers.map((item) => (
                    <div className="score-row" key={item.label}>
                      <span>{item.label}</span>
                      <b>
                        <SurveyAnswerValue value={item.value} type={item.type} />
                      </b>
                    </div>
                  ))
                ) : (
                  <p className="empty">No answers in this survey.</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="empty">No onboarding or survey responses yet.</p>
        )}
      </section>
    </div>
  );
}
