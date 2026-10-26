"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  EXERCISES,
  SKILLS,
  examReadMinutes,
  paceBand,
  recentRange,
  recommend,
  skillProfile,
  type DrillAttempt,
  type ReadingCheckResult,
  type SkillKey,
} from "@/lib/reading-drills";
import { fetchReadingHistory } from "@/lib/reading-drills-store";
import { useStudentSession } from "@/lib/student-session";

export default function ReadingHub() {
  const { user } = useStudentSession();
  const [attempts, setAttempts] = useState<DrillAttempt[]>([]);
  const [checks, setChecks] = useState<ReadingCheckResult[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    fetchReadingHistory(user.id).then((h) => {
      setAttempts(h.attempts);
      setChecks(h.checks);
      setLoaded(true);
    });
  }, [user?.id]);

  const rec = recommend(attempts);
  const sk = skillProfile(attempts);
  const range = recentRange(attempts);
  const lastCheck = checks.at(-1);
  const done: Record<string, number> = {};
  attempts.forEach((a) => (done[a.exercise_id] = (done[a.exercise_id] || 0) + 1));

  return (
    <article className="lesson-body wide rd-page">
      <h1>Read the Required</h1>
      <p>
        A ten-minute drill on the two skills that cost the most marks: answering exactly what the required asks (RTFQ), and using the marks
        the case hands you (Buried Treasure). You read a short case at exam pace and index it with margin notes, show you absorbed what it
        is about, break down the required, index the case for the marks, then answer.
      </p>

      <div className="rd-stack">
        {loaded && !lastCheck ? (
          <section className="rd-sheet rd-stack rd-start">
            <span className="rd-eyebrow">Start here</span>
            <div className="rd-row">
              <div>
                <h2>Reading check</h2>
                <p className="muted small">A three-page case and ten questions, no required. About 10 to 15 minutes.</p>
              </div>
              <Link className="primary rd-push" href="/student/reading/check">Start</Link>
            </div>
            <p>It measures how fast you read with notes, and how much of the big picture you take in, so you know where you stand against the exam.</p>
          </section>
        ) : null}
        {lastCheck ? (
          <section className="rd-sheet rd-row">
            <div>
              <span className="rd-eyebrow">Reading check</span>
              <h2>{lastCheck.profile}</h2>
              <p className="muted small">
                {lastCheck.wpm} words a minute ({paceBand(lastCheck.wpm).label}) · {lastCheck.absorb} of {lastCheck.absorb_n} absorbed · a full
                exam case would take about {examReadMinutes(lastCheck.wpm)} minutes
              </p>
            </div>
            <Link className="rd-push" href="/student/reading/check">Retake</Link>
          </section>
        ) : null}

        <section className="rd-sheet rd-stack">
          <span className="rd-eyebrow">Your next exercise</span>
          <div className="rd-row">
            <div>
              <h2>{rec.exercise.title}</h2>
              <p className="muted small">{rec.exercise.area} · {rec.exercise.marks} marks · about 10 minutes</p>
            </div>
            <Link className="primary rd-push" href={`/student/reading/${rec.exercise.id}`}>Start</Link>
          </div>
          <p className="rd-note">{rec.reason}</p>
        </section>

        {attempts.length ? (
          <section className="rd-sheet rd-stack">
            <span className="rd-eyebrow">Your skills (last three exercises)</span>
            {(Object.keys(SKILLS) as SkillKey[]).map((k) => (
              <div key={k} className="rd-skill">
                <span>{SKILLS[k]}</span>
                <div className="rd-bar"><i style={{ width: `${sk[k] == null ? 0 : Math.round((sk[k] as number) * 100)}%` }} /></div>
                <span className="muted small">{sk[k] == null ? "–" : `${Math.round((sk[k] as number) * 100)}%`}</span>
              </div>
            ))}
            <p className="muted small">
              {attempts.length} exercise{attempts.length === 1 ? "" : "s"} done.
              {range ? <> Recent results: <b>{range.label}</b> ({range.verdict.toLowerCase()}).</> : null}
            </p>
          </section>
        ) : null}

        <section className="rd-stack">
          <span className="rd-eyebrow">All exercises</span>
          {EXERCISES.map((ex) => (
            <div key={ex.id} className={`rd-sheet rd-row${ex.id === rec.exercise.id ? " rd-rec" : ""}`}>
              <div>
                <b>{ex.title}</b>
                <div className="muted small">
                  {ex.area} · {ex.marks} marks{done[ex.id] ? ` · done ${done[ex.id]}×` : ""} · trains {ex.trains.map((k) => SKILLS[k]).join(", ")}
                </div>
              </div>
              <Link className="rd-push" href={`/student/reading/${ex.id}`}>Start</Link>
            </div>
          ))}
        </section>
      </div>
    </article>
  );
}
