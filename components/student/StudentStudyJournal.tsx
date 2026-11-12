"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import ExamCountdownBadge from "@/components/student/ExamCountdownBadge";
import StudentCourseProgress from "@/components/student/StudentCourseProgress";
import { DEFAULT_LMS_COURSE_ID } from "@/lib/lms-catalog";
import { useLmsCourse } from "@/lib/lms-course-context";
import { useStudentSession } from "@/lib/student-session";
import { MONTHS } from "@/lib/dates";
import { portalToday } from "@/lib/student-task-due-dates";
import {
  daysUntilExam,
  emptyJournalCourseDay,
  emptyJournalDay,
  emptyJournalPrivacy,
  emptyJournalWeek,
  fetchJournalCourseActivity,
  fetchJournalPrivacy,
  fetchStudyJournalWeek,
  fetchStudyJournalWeeks,
  JOURNAL_EXAM_ON,
  JOURNAL_MOODS,
  JOURNAL_NEEDS,
  JOURNAL_PLAN,
  JOURNAL_STUDIED,
  JOURNAL_WEEKDAYS,
  JOURNAL_WHERE,
  journalCourseDayLabel,
  journalWeekDates,
  journalWeekLabel,
  journalWeekStart,
  questionStatsFromWeeks,
  saveJournalPrivacy,
  saveStudyJournalWeek,
  shiftJournalWeek,
  type JournalCourseDay,
  type JournalDay,
  type JournalPrivacy,
  type StudyJournalWeek,
} from "@/lib/study-journal";
import { taskDueItemsFromOutline } from "@/lib/student-task-due-dates";
import { useVisibleCourseOutline } from "@/lib/visible-course-outline";

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
    const width = Math.min(window.innerWidth - 16, Math.max(rect.width, 260));
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const up = spaceBelow < 240 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(140, Math.min(320, up ? spaceAbove : spaceBelow));
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
            {current.emoji ? (
              <span className="journal-select-emoji" aria-hidden="true">
                {current.emoji}
              </span>
            ) : null}
            <span className="journal-select-value">{current.label}</span>
          </>
        ) : (
          <span className="journal-select-value is-placeholder">{placeholder}</span>
        )}
        <ChevronDown size={16} aria-hidden="true" />
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
                  {option.emoji ? (
                    <span className="journal-select-emoji" aria-hidden="true">
                      {option.emoji}
                    </span>
                  ) : null}
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

function JournalDayCard({
  date,
  weekday,
  day,
  isToday,
  course,
  onChange,
}: {
  date: string;
  weekday: string;
  day: JournalDay;
  isToday: boolean;
  course: JournalCourseDay | undefined;
  onChange: (patch: Partial<JournalDay>) => void;
}) {
  return (
    <article className={`study-journal-day${isToday ? " is-today" : ""}`}>
      <header>
        <h3>{weekday}</h3>
        <p>
          {Number(date.slice(8, 10))} {MONTHS[Number(date.slice(5, 7)) - 1]}
        </p>
      </header>
      <p className="journal-course-activity">{journalCourseDayLabel(course || emptyJournalCourseDay())}</p>
      <p className="journal-field-label">Did you study?</p>
      <JournalSelect
        name={`Did you study ${weekday}`}
        placeholder="Choose"
        options={JOURNAL_STUDIED}
        value={day.studied}
        onChange={(studied) => onChange({ studied })}
      />
      <p className="journal-field-label">Which question did you do?</p>
      <input
        type="text"
        value={day.studiedWhat}
        onChange={(event) => onChange({ studiedWhat: event.target.value, questionsDone: event.target.value.trim() ? day.questionsDone || 1 : null })}
        placeholder="e.g. Paper 1 Q2"
      />
      <p className="journal-field-label">Did you stick to your plan?</p>
      <JournalSelect
        name={`Plan ${weekday}`}
        placeholder="Choose"
        options={JOURNAL_PLAN}
        value={day.stuckToPlan}
        onChange={(stuckToPlan) => onChange({ stuckToPlan })}
      />
      <p className="journal-field-label">How did today go?</p>
      <JournalSelect
        name={`How did ${weekday} go`}
        placeholder="Choose"
        options={JOURNAL_MOODS}
        value={day.mood}
        onChange={(mood) => onChange({ mood })}
      />
      <textarea
        rows={2}
        value={day.note}
        onChange={(event) => onChange({ note: event.target.value })}
        placeholder="Note for self"
      />
    </article>
  );
}

export default function StudentStudyJournal({ compact = false }: { compact?: boolean }) {
  const { course } = useLmsCourse();
  const { user } = useStudentSession();
  const outline = useVisibleCourseOutline();
  const [weekStart, setWeekStart] = useState(journalWeekStart());
  const [week, setWeek] = useState<StudyJournalWeek | null>(null);
  const [weeks, setWeeks] = useState<StudyJournalWeek[]>([]);
  const [privacy, setPrivacy] = useState<JournalPrivacy>(emptyJournalPrivacy);
  const [activity, setActivity] = useState<Record<string, JournalCourseDay>>({});
  const [status, setStatus] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const iac = course.id === DEFAULT_LMS_COURSE_ID;
  const today = portalToday();
  const dates = journalWeekDates(weekStart);
  const tasks = taskDueItemsFromOutline(outline);
  const taskKey = tasks.map((task) => `${task.assignmentLessonId}:${task.label}`).join("|");

  useEffect(() => {
    if (!user?.id || !iac) return;
    let cancelled = false;
    setWeek(emptyJournalWeek(weekStart));
    Promise.all([
      fetchStudyJournalWeek(user.id, weekStart),
      fetchJournalPrivacy(user.id),
      compact ? Promise.resolve({ ok: true, weeks: [] as StudyJournalWeek[], error: "" }) : fetchStudyJournalWeeks(user.id),
      fetchJournalCourseActivity(user.id, tasks),
    ]).then(([result, nextPrivacy, history, courseDays]) => {
      if (cancelled) return;
      setWeek(result.week);
      setPrivacy(nextPrivacy.privacy);
      const others = history.weeks.filter((item) => item.weekStart !== result.week.weekStart);
      setWeeks([...others, result.week]);
      setActivity(courseDays);
      setStatus(result.error || nextPrivacy.error || history.error || "");
    });
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [user?.id, weekStart, iac, compact, taskKey]);

  const persist = async (next: StudyJournalWeek) => {
    if (!user?.id) return;
    const result = await saveStudyJournalWeek(user.id, next);
    if (result.ok === false) {
      setStatus(result.error);
      return;
    }
    setPrivacy(result.privacy);
    setStatus(
      compact ? "Saved." : result.privacy.private ? "Saved. Private to you." : "Saved. Yvonne can see this planner."
    );
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
  const todayIndex = dates.indexOf(today);
  const todayWeekday = JOURNAL_WEEKDAYS[todayIndex] || JOURNAL_WEEKDAYS[0];
  const todayDay = week?.days[today] || emptyJournalDay();

  const privacyNotice = !privacy.promptSeen ? (
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
  );

  if (compact) {
    return (
      <div className="study-journal is-compact">
        <section className="study-journal-sheet">
          <div className="study-journal-head">
            <div>
              <p className="kicker">Study journal</p>
              <h2>Today</h2>
              <p className="muted small">{todayWeekday}</p>
            </div>
            <div className="study-journal-tools">
              <Link href="/student/journal" className="ghost">
                Go to journal
              </Link>
            </div>
          </div>
          <div className="study-journal-days">
            <JournalDayCard
              date={today}
              weekday={todayWeekday}
              day={todayDay}
              isToday
              course={activity[today]}
              onChange={(patch) => setDay(today, patch)}
            />
          </div>
          {status ? <p className="muted small">{status}</p> : null}
        </section>
      </div>
    );
  }

  return (
    <div className="study-journal">
      <StudentCourseProgress />
      <section className="study-journal-sheet">
        {privacyNotice}
        <div className="study-journal-head">
          <div>
            <p className="kicker">Study journal</p>
            <h2>My weekly study plan</h2>
            <p className="muted small">Seven-day week · {journalWeekLabel(weekStart)}</p>
          </div>
          <div className="study-journal-tools">
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
            <ExamCountdownBadge days={countdown} />
          </div>
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
          {dates.map((date, index) => (
            <JournalDayCard
              key={date}
              date={date}
              weekday={JOURNAL_WEEKDAYS[index]}
              day={week?.days[date] || emptyJournalDay()}
              isToday={date === today}
              course={activity[date]}
              onChange={(patch) => setDay(date, patch)}
            />
          ))}
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
