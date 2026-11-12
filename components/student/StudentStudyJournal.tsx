"use client";

import { useEffect, useRef, useState } from "react";
import StudentCourseProgress from "@/components/student/StudentCourseProgress";
import { DEFAULT_LMS_COURSE_ID } from "@/lib/lms-catalog";
import { useLmsCourse } from "@/lib/lms-course-context";
import { useStudentSession } from "@/lib/student-session";
import { MONTHS } from "@/lib/dates";
import { portalToday } from "@/lib/student-task-due-dates";
import {
  daysUntilExam,
  emptyJournalDay,
  emptyJournalPrivacy,
  emptyJournalWeek,
  fetchJournalPrivacy,
  fetchStudyJournalWeek,
  JOURNAL_MOODS,
  JOURNAL_NEEDS,
  JOURNAL_PLAN,
  JOURNAL_STUDIED,
  JOURNAL_WEEKDAYS,
  JOURNAL_WHERE,
  journalMood,
  journalWeekDates,
  journalWeekLabel,
  journalWeekStart,
  questionsByExamDate,
  saveJournalPrivacy,
  saveStudyJournalWeek,
  shiftJournalWeek,
  type JournalDay,
  type JournalPrivacy,
  type StudyJournalWeek,
} from "@/lib/study-journal";

function ChoiceButtons({
  options,
  value,
  onChange,
  name,
}: {
  options: ReadonlyArray<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
  name: string;
}) {
  return (
    <div className="journal-choices" role="group" aria-label={name}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={value === option.id ? "is-on" : ""}
          onClick={() => onChange(value === option.id ? "" : option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function MoodPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const current = journalMood(value);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="journal-mood" ref={wrap}>
      <button type="button" className="journal-mood-trigger" aria-expanded={open} onClick={() => setOpen((currentOpen) => !currentOpen)}>
        {current ? (
          <>
            <span aria-hidden="true">{current.emoji}</span>
            {current.label}
          </>
        ) : (
          "How did today go?"
        )}
      </button>
      {open ? (
        <div className="journal-mood-pop" role="listbox" aria-label="How did today go?">
          {JOURNAL_MOODS.map((mood) => (
            <button
              key={mood.id}
              type="button"
              role="option"
              aria-selected={value === mood.id}
              className={value === mood.id ? "is-on" : ""}
              onClick={() => {
                onChange(mood.id);
                setOpen(false);
              }}
            >
              <span aria-hidden="true">{mood.emoji}</span>
              {mood.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function StudentStudyJournal() {
  const { course } = useLmsCourse();
  const { user } = useStudentSession();
  const [weekStart, setWeekStart] = useState(journalWeekStart());
  const [week, setWeek] = useState<StudyJournalWeek | null>(null);
  const [privacy, setPrivacy] = useState<JournalPrivacy>(emptyJournalPrivacy);
  const [status, setStatus] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const iac = course.id === DEFAULT_LMS_COURSE_ID;
  const today = portalToday();
  const dates = journalWeekDates(weekStart);

  useEffect(() => {
    if (!user?.id || !iac) return;
    let cancelled = false;
    setWeek(emptyJournalWeek(weekStart));
    Promise.all([fetchStudyJournalWeek(user.id, weekStart), fetchJournalPrivacy(user.id)]).then(([result, nextPrivacy]) => {
      if (cancelled) return;
      setWeek(result.week);
      setPrivacy(nextPrivacy.privacy);
      setStatus(result.error || nextPrivacy.error || "");
    });
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [user?.id, weekStart, iac]);

  const persist = async (next: StudyJournalWeek) => {
    if (!user?.id) return;
    const result = await saveStudyJournalWeek(user.id, next);
    if (result.ok === false) {
      setStatus(result.error);
      return;
    }
    setPrivacy(result.privacy);
    setStatus(result.privacy.private ? "Saved. Private to you." : "Saved. Yvonne can see this planner.");
  };

  const setPrivate = async (nextPrivate: boolean) => {
    if (!user?.id) return;
    const result = await saveJournalPrivacy(user.id, { private: nextPrivate, promptSeen: true });
    if (result.ok === false) {
      setStatus(result.error);
      return;
    }
    setPrivacy(result.privacy);
    setStatus(result.privacy.private ? "Saved. Private to you." : "Saved. Yvonne can see this planner.");
  };

  const update = (next: StudyJournalWeek) => {
    setWeek(next);
    setStatus("Saving…");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void persist(next);
    }, 800);
  };

  const setField = (patch: Partial<StudyJournalWeek>) => {
    if (!week) return;
    update({ ...week, ...patch });
  };

  const setDay = (date: string, patch: Partial<JournalDay>) => {
    if (!week) return;
    update({
      ...week,
      days: { ...week.days, [date]: { ...(week.days[date] || emptyJournalDay()), ...patch } },
    });
  };

  if (!iac || !user) return null;
  const countdown = daysUntilExam(week?.examOn, today);
  const projected = questionsByExamDate(week?.questionsPerWeek, week?.examOn, today);

  return (
    <div className="study-journal">
      <StudentCourseProgress />
      <section className="study-journal-sheet">
        {!privacy.promptSeen ? (
          <p className="notice study-journal-privacy">
            Yvonne can see your planner.{" "}
            <button type="button" className="link-btn" onClick={() => void setPrivate(true)}>
              Click here
            </button>{" "}
            if you want to keep this private so only you can see it.
          </p>
        ) : (
          <p className="muted small study-journal-privacy-status">
            {privacy.private ? "This planner is private to you." : "Yvonne can see this planner."}{" "}
            <button type="button" className="link-btn" onClick={() => void setPrivate(!privacy.private)}>
              {privacy.private ? "Let Yvonne see it" : "Keep it private"}
            </button>
          </p>
        )}
        <div className="study-journal-head">
          <div>
            <p className="kicker">Study journal</p>
            <h2>My weekly study plan</h2>
            <p className="muted small">Seven-day week · {journalWeekLabel(weekStart)}</p>
          </div>
          <div className="study-journal-nav">
            <button type="button" className="ghost" onClick={() => setWeekStart((current) => shiftJournalWeek(current, -1))}>
              ← Previous
            </button>
            <button type="button" className="ghost" onClick={() => setWeekStart(journalWeekStart())}>
              This week
            </button>
            <button type="button" className="ghost" onClick={() => setWeekStart((current) => shiftJournalWeek(current, 1))}>
              Next →
            </button>
          </div>
        </div>

        <div className="study-journal-exam">
          <label>
            Exam date
            <input type="date" value={week?.examOn || ""} onChange={(event) => setField({ examOn: event.target.value || null })} />
          </label>
          <p className="study-journal-countdown">
            {countdown == null
              ? "Add your exam date for the countdown."
              : countdown < 0
                ? "Exam date has passed."
                : countdown === 0
                  ? "Exam day."
                  : `${countdown} day${countdown === 1 ? "" : "s"} to exam`}
          </p>
        </div>

        <div className="study-journal-days">
          {dates.map((date, index) => {
            const day = week?.days[date] || emptyJournalDay();
            const weekday = JOURNAL_WEEKDAYS[index];
            const isToday = date === today;
            return (
              <article key={date} className={`study-journal-day${isToday ? " is-today" : ""}`}>
                <header>
                  <h3>{weekday}</h3>
                  <p>
                    {Number(date.slice(8, 10))} {MONTHS[Number(date.slice(5, 7)) - 1]}
                  </p>
                </header>
                <p className="journal-field-label">Did you study?</p>
                <ChoiceButtons
                  name={`Studied ${weekday}`}
                  options={JOURNAL_STUDIED}
                  value={day.studied}
                  onChange={(studied) => setDay(date, { studied })}
                />
                {day.studied === "yes" ? (
                  <input
                    type="text"
                    value={day.studiedWhat}
                    onChange={(event) => setDay(date, { studiedWhat: event.target.value })}
                    placeholder="Course content"
                  />
                ) : null}
                <p className="journal-field-label">Did you stick to your plan?</p>
                <ChoiceButtons
                  name={`Plan ${weekday}`}
                  options={JOURNAL_PLAN}
                  value={day.stuckToPlan}
                  onChange={(stuckToPlan) => setDay(date, { stuckToPlan })}
                />
                <p className="journal-field-label">How did today go?</p>
                <MoodPicker value={day.mood} onChange={(mood) => setDay(date, { mood })} />
                <textarea
                  rows={2}
                  value={day.note}
                  onChange={(event) => setDay(date, { note: event.target.value })}
                  placeholder="Note for self"
                />
              </article>
            );
          })}
          <article className="study-journal-day study-journal-goals">
            <header>
              <h3>This week’s goals</h3>
            </header>
            <textarea
              rows={8}
              value={week?.weekGoals || ""}
              onChange={(event) => setField({ weekGoals: event.target.value })}
              placeholder="What do you want this week to look like?"
            />
          </article>
        </div>

        <div className="study-journal-analytics">
          <h3>Analytics</h3>
          <label>
            Last question I did
            <input
              type="text"
              value={week?.lastQuestion || ""}
              onChange={(event) => setField({ lastQuestion: event.target.value })}
              placeholder="Paper 1 Q2, or the last drill"
            />
          </label>
          <div className="study-journal-analytics-row">
            <label>
              Questions per week
              <input
                type="number"
                min={0}
                value={week?.questionsPerWeek ?? ""}
                onChange={(event) => setField({ questionsPerWeek: event.target.value === "" ? null : Number(event.target.value) })}
              />
            </label>
            <p>
              <span className="journal-field-label">Number of questions by exam date</span>
              <strong>{projected == null ? "—" : projected}</strong>
            </p>
          </div>
          <p className="journal-field-label">Am I where I want to be?</p>
          <ChoiceButtons name="Where I want to be" options={JOURNAL_WHERE} value={week?.whereIAm || ""} onChange={(whereIAm) => setField({ whereIAm })} />
          <p className="journal-field-label">What I need for the week</p>
          <ChoiceButtons name="What I need" options={JOURNAL_NEEDS} value={week?.weekNeed || ""} onChange={(weekNeed) => setField({ weekNeed })} />
          {week?.weekNeed === "other" ? (
            <input
              type="text"
              value={week.weekNeedOther}
              onChange={(event) => setField({ weekNeedOther: event.target.value })}
              placeholder="Other"
            />
          ) : null}
        </div>
        {status ? <p className="muted small">{status}</p> : null}
      </section>
    </div>
  );
}
