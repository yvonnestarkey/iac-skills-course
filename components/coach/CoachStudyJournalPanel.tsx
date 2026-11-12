"use client";

import { useEffect, useState } from "react";
import {
  fetchCoachStudyJournal,
  JOURNAL_NEEDS,
  JOURNAL_PLAN,
  JOURNAL_STUDIED,
  JOURNAL_WEEKDAYS,
  JOURNAL_WHERE,
  journalChoiceLabel,
  journalDayFilled,
  journalMood,
  journalWeekDates,
  journalWeekLabel,
  type StudyJournalWeek,
} from "@/lib/study-journal";

function DaySummary({ date, weekday, week }: { date: string; weekday: string; week: StudyJournalWeek }) {
  const day = week.days[date];
  if (!journalDayFilled(day)) return null;
  const mood = journalMood(day.mood);
  const studied = journalChoiceLabel(JOURNAL_STUDIED, day.studied);
  const plan = journalChoiceLabel(JOURNAL_PLAN, day.stuckToPlan);
  return (
    <article className="coach-journal-day">
      <h3>
        {weekday} · {date}
      </h3>
      <dl className="fact-list">
        {studied ? (
          <div>
            <dt>Did they study?</dt>
            <dd>
              {studied}
              {day.studiedWhat ? ` · ${day.studiedWhat}` : ""}
            </dd>
          </div>
        ) : null}
        {plan ? (
          <div>
            <dt>Stuck to plan</dt>
            <dd>{plan}</dd>
          </div>
        ) : null}
        {mood ? (
          <div>
            <dt>How did today go?</dt>
            <dd>
              {mood.emoji} {mood.label}
            </dd>
          </div>
        ) : null}
        {day.note ? (
          <div>
            <dt>Note</dt>
            <dd>{day.note}</dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}

export default function CoachStudyJournalPanel({ studentId }: { studentId: string }) {
  const [hidden, setHidden] = useState(false);
  const [weeks, setWeeks] = useState<StudyJournalWeek[]>([]);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchCoachStudyJournal(studentId).then((result) => {
      if (cancelled) return;
      setHidden(result.hidden);
      setWeeks(result.weeks);
      setError(result.error || "");
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  return (
    <section className="card">
      <h2>Study journal</h2>
      {!ready ? <p className="muted small">Loading…</p> : null}
      {error ? <p className="muted small">{error}</p> : null}
      {ready && hidden ? <p>This student kept their study journal private.</p> : null}
      {ready && !hidden && !weeks.length ? <p className="muted">No study journal entries yet.</p> : null}
      {weeks.map((week) => {
        const dates = journalWeekDates(week.weekStart);
        return (
          <article key={week.weekStart} className="coach-journal-week">
            <h3>{journalWeekLabel(week.weekStart)}</h3>
            <dl className="fact-list">
              {week.examOn ? (
                <div>
                  <dt>Exam date</dt>
                  <dd>{week.examOn}</dd>
                </div>
              ) : null}
              {week.weekGoals ? (
                <div>
                  <dt>This week’s goals</dt>
                  <dd>{week.weekGoals}</dd>
                </div>
              ) : null}
              {week.lastQuestion ? (
                <div>
                  <dt>Last question</dt>
                  <dd>{week.lastQuestion}</dd>
                </div>
              ) : null}
              {week.questionsPerWeek != null ? (
                <div>
                  <dt>Questions per week</dt>
                  <dd>{week.questionsPerWeek}</dd>
                </div>
              ) : null}
              {week.whereIAm ? (
                <div>
                  <dt>Where they want to be</dt>
                  <dd>{journalChoiceLabel(JOURNAL_WHERE, week.whereIAm)}</dd>
                </div>
              ) : null}
              {week.weekNeed ? (
                <div>
                  <dt>What they need</dt>
                  <dd>
                    {journalChoiceLabel(JOURNAL_NEEDS, week.weekNeed)}
                    {week.weekNeedOther ? ` · ${week.weekNeedOther}` : ""}
                  </dd>
                </div>
              ) : null}
            </dl>
            <div className="coach-journal-days">
              {dates.map((date, index) => (
                <DaySummary key={date} date={date} weekday={JOURNAL_WEEKDAYS[index]} week={week} />
              ))}
            </div>
          </article>
        );
      })}
    </section>
  );
}
