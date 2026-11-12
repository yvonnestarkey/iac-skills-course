"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  fetchStudyJournalWeeks,
  JOURNAL_EXAM_LABEL,
  JOURNAL_EXAM_ON,
  JOURNAL_MOODS,
  JOURNAL_NEEDS,
  JOURNAL_PLAN,
  JOURNAL_STUDIED,
  JOURNAL_WEEKDAYS,
  JOURNAL_WHERE,
  journalWeekDates,
  journalWeekLabel,
  journalWeekStart,
  questionStatsFromWeeks,
  saveJournalPrivacy,
  saveStudyJournalWeek,
  shiftJournalWeek,
  type JournalDay,
  type JournalPrivacy,
  type StudyJournalWeek,
} from "@/lib/study-journal";

type MenuOption = { id: string; label: string; emoji?: string };

function JournalSelect({
  options,
  value,
  onChange,
  placeholder,
  name,
}: {
  options: ReadonlyArray<MenuOption>;
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 220, maxHeight: 240, up: false });
  const current = options.find((option) => option.id === value);

  const place = () => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.max(rect.width, 220);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const up = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, Math.min(280, up ? spaceAbove : spaceBelow));
    setCoords({
      top: up ? rect.top - 6 : rect.bottom + 6,
      left,
      width,
      maxHeight,
      up,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onMove = () => place();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      const node = event.target as Node;
      if (trigger.current?.contains(node) || menu.current?.contains(node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="journal-select">
      <button
        ref={trigger}
        type="button"
        className="journal-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={name}
        onClick={() => setOpen((currentOpen) => !currentOpen)}
      >
        {current ? (
          <>
            {current.emoji ? <span aria-hidden="true">{current.emoji}</span> : null}
            {current.label}
          </>
        ) : (
          placeholder
        )}
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menu}
              className="journal-select-menu"
              role="listbox"
              aria-label={name}
              style={{
                top: coords.up ? "auto" : coords.top,
                bottom: coords.up ? window.innerHeight - coords.top : "auto",
                left: coords.left,
                width: coords.width,
                maxHeight: coords.maxHeight,
              }}
            >
              {options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={value === option.id}
                  className={value === option.id ? "is-on" : ""}
                  onClick={() => {
                    onChange(value === option.id ? "" : option.id);
                    setOpen(false);
                  }}
                >
                  {option.emoji ? <span aria-hidden="true">{option.emoji}</span> : null}
                  {option.label}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

export default function StudentStudyJournal() {
  const { course } = useLmsCourse();
  const { user } = useStudentSession();
  const [weekStart, setWeekStart] = useState(journalWeekStart());
  const [week, setWeek] = useState<StudyJournalWeek | null>(null);
  const [weeks, setWeeks] = useState<StudyJournalWeek[]>([]);
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
    Promise.all([
      fetchStudyJournalWeek(user.id, weekStart),
      fetchJournalPrivacy(user.id),
      fetchStudyJournalWeeks(user.id),
    ]).then(([result, nextPrivacy, history]) => {
      if (cancelled) return;
      setWeek(result.week);
      setPrivacy(nextPrivacy.privacy);
      const others = history.weeks.filter((item) => item.weekStart !== result.week.weekStart);
      setWeeks([...others, result.week]);
      setStatus(result.error || nextPrivacy.error || history.error || "");
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
    setWeeks((current) => [...current.filter((item) => item.weekStart !== next.weekStart), next]);
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
  const countdown = daysUntilExam(JOURNAL_EXAM_ON, today);
  const stats = questionStatsFromWeeks(weeks, today, JOURNAL_EXAM_ON);

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
          <p className="journal-field-label">Countdown to exam · {JOURNAL_EXAM_LABEL}</p>
          <p className="study-journal-countdown">
            {countdown == null
              ? "Exam date coming soon."
              : countdown < 0
                ? "Exam date has passed."
                : countdown === 0
                  ? "Exam day."
                  : `${countdown} day${countdown === 1 ? "" : "s"} to exam`}
          </p>
        </div>

        <div className="study-journal-need">
          <p className="journal-field-label">What I need for the week</p>
          <JournalSelect
            name="What I need for the week"
            placeholder="Choose one"
            options={JOURNAL_NEEDS}
            value={week?.weekNeed || ""}
            onChange={(weekNeed) => setField({ weekNeed })}
          />
          {week?.weekNeed === "other" ? (
            <input
              type="text"
              value={week.weekNeedOther}
              onChange={(event) => setField({ weekNeedOther: event.target.value })}
              placeholder="Other"
            />
          ) : null}
        </div>

        <div className="study-journal-days">
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
                <JournalSelect
                  name={`Did you study ${weekday}`}
                  placeholder="Yes / No"
                  options={JOURNAL_STUDIED}
                  value={day.studied}
                  onChange={(studied) =>
                    setDay(date, {
                      studied,
                      questionsDone: studied === "yes" ? day.questionsDone || 1 : null,
                    })
                  }
                />
                {day.studied === "yes" ? (
                  <>
                    <input
                      type="text"
                      value={day.studiedWhat}
                      onChange={(event) => setDay(date, { studiedWhat: event.target.value })}
                      placeholder="Course content / question"
                    />
                    <label className="journal-field-label">
                      Questions done
                      <input
                        type="number"
                        min={0}
                        value={day.questionsDone ?? ""}
                        onChange={(event) =>
                          setDay(date, { questionsDone: event.target.value === "" ? null : Number(event.target.value) })
                        }
                      />
                    </label>
                  </>
                ) : null}
                <p className="journal-field-label">Did you stick to your plan?</p>
                <JournalSelect
                  name={`Plan ${weekday}`}
                  placeholder="Yes / No / Didn't have a plan"
                  options={JOURNAL_PLAN}
                  value={day.stuckToPlan}
                  onChange={(stuckToPlan) => setDay(date, { stuckToPlan })}
                />
                <p className="journal-field-label">How did today go?</p>
                <JournalSelect
                  name={`How did ${weekday} go`}
                  placeholder="How did today go?"
                  options={JOURNAL_MOODS}
                  value={day.mood}
                  onChange={(mood) => setDay(date, { mood })}
                />
                <textarea
                  rows={2}
                  value={day.note}
                  onChange={(event) => setDay(date, { note: event.target.value })}
                  placeholder="Note for self"
                />
              </article>
            );
          })}
        </div>

        <div className="study-journal-analytics">
          <h3>Analytics</h3>
          <div className="study-journal-analytics-row">
            <p>
              <span className="journal-field-label">Last question I did</span>
              <strong>{stats.lastQuestion || "—"}</strong>
              {stats.lastQuestionOn ? <span className="muted small">{stats.lastQuestionOn}</span> : null}
            </p>
            <p>
              <span className="journal-field-label">Questions done</span>
              <strong>{stats.questionsDone}</strong>
            </p>
            <p>
              <span className="journal-field-label">Estimated questions by exam day</span>
              <strong>{stats.estimatedByExam == null ? "—" : stats.estimatedByExam}</strong>
            </p>
          </div>
          <p className="journal-field-label">Am I where I want to be?</p>
          <JournalSelect
            name="Where I want to be"
            placeholder="Yes / No / Not sure / Sort of"
            options={JOURNAL_WHERE}
            value={week?.whereIAm || ""}
            onChange={(whereIAm) => setField({ whereIAm })}
          />
        </div>
        {status ? <p className="muted small">{status}</p> : null}
      </section>
    </div>
  );
}
