"use client";

import RichTextField from "@/components/ui/RichTextField";
import { fetchChapterLessons, type ChapterLessonOption, type CourseChapterOption } from "@/lib/custom-surveys";
import {
  DRIP_CATEGORIES,
  DRIP_DELAY_PRESETS,
  delayDaysFromParts,
  delayPartsFromDays,
  dripCategory,
  dripCategoryLabel,
  isTaskChapterOption,
  triggersForCategory,
  type DripCategory,
  type DripDelayUnit,
  type DripWrite,
} from "@/lib/drip-messages";

export default function DripMessageFields({
  form,
  onChange,
  chapters = [],
  lessons = [],
  lessonChapterId = "",
  onLessons,
  lockCategory,
  showCopy = true,
}: {
  form: DripWrite;
  onChange: (next: Partial<DripWrite>) => void;
  chapters?: CourseChapterOption[];
  lessons?: ChapterLessonOption[];
  lessonChapterId?: string;
  onLessons?: (chapterId: string) => void;
  lockCategory?: DripCategory;
  showCopy?: boolean;
}) {
  const category = lockCategory || dripCategory(form.trigger);
  const delay = delayPartsFromDays(form.delayDays);
  const taskChapters = chapters.filter((chapter) => isTaskChapterOption(chapter.title));

  const setCategory = (next: DripCategory) => {
    if (lockCategory) return;
    onChange({
      trigger: next === "progress" && form.trigger === "task_completed" ? "task_completed" : triggersForCategory(next),
    });
  };

  const setDelay = (amount: number, unit: DripDelayUnit) => {
    onChange({ delayDays: delayDaysFromParts(amount, unit) });
  };

  return (
    <div className="drip-fields">
      {showCopy ? (
        <>
          <div className="plan-field">
            <label htmlFor="drip-title">
              <strong>Title</strong>
            </label>
            <input
              id="drip-title"
              className="select-line"
              type="text"
              value={form.title}
              onChange={(event) => onChange({ title: event.target.value })}
              placeholder="Two weeks in — how is Task 1 going?"
            />
          </div>
          <div className="plan-field">
            <label htmlFor="drip-body">
              <strong>Message</strong>
            </label>
            <RichTextField
              id="drip-body"
              rows={6}
              value={form.body}
              onChange={(body) => onChange({ body })}
              placeholder="This lands in the student's notifications inbox, and they get an email too."
            />
          </div>
        </>
      ) : null}

      {lockCategory ? null : (
        <div className="plan-field">
          <strong>Category</strong>
          <div className="drip-categories" role="tablist" aria-label="Drip message category">
            {DRIP_CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                className={`drip-chip ${category === item ? "on" : ""}`}
                aria-selected={category === item}
                onClick={() => setCategory(item)}
              >
                {dripCategoryLabel(item)}
              </button>
            ))}
          </div>
        </div>
      )}

      {category === "enrolment" ? (
        <div className="plan-field">
          <strong>When after enrolment</strong>
          <div className="drip-timeline" role="list">
            {DRIP_DELAY_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className={`drip-chip ${form.delayDays === preset.days ? "on" : ""}`}
                onClick={() => onChange({ delayDays: preset.days })}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="hours-row drip-delay-custom">
            <input
              id="drip-delay"
              aria-label="Custom delay amount"
              type="number"
              min={0}
              value={delay.amount}
              onChange={(event) => setDelay(Math.max(0, Number(event.target.value) || 0), delay.unit)}
            />
            <select
              id="drip-delay-unit"
              className="select-line"
              aria-label="Delay unit"
              value={delay.unit}
              onChange={(event) => setDelay(delay.amount, event.target.value as DripDelayUnit)}
            >
              <option value="days">Days after</option>
              <option value="weeks">Weeks after</option>
              <option value="months">Months after</option>
            </select>
          </div>
          <p className="muted small">Day of sends on the enrolment date. The number is editable if you need 3 days, 2 weeks, or 6 weeks.</p>
        </div>
      ) : null}

      {category === "date" ? (
        <div className="plan-field">
          <label htmlFor="drip-date">
            <strong>Send on this date (SAST)</strong>
          </label>
          <input
            id="drip-date"
            className="select-line drip-calendar"
            type="date"
            value={form.sendOn || ""}
            onChange={(event) => onChange({ sendOn: event.target.value })}
          />
          <p className="muted small">Opens a calendar. The message sends on that day and waits in the inbox if they sign in later.</p>
        </div>
      ) : null}

      {category === "progress" ? (
        <>
          {lockCategory ? (
            <p className="muted small">Sends the day the student marks this lesson complete.</p>
          ) : (
            <div className="plan-field">
              <strong>Progress trigger</strong>
              <div className="drip-categories">
                <button
                  type="button"
                  className={`drip-chip ${form.trigger === "lesson_completed" ? "on" : ""}`}
                  onClick={() => onChange({ trigger: "lesson_completed" })}
                >
                  Complete a lesson
                </button>
                <button
                  type="button"
                  className={`drip-chip ${form.trigger === "task_completed" ? "on" : ""}`}
                  onClick={() => onChange({ trigger: "task_completed" })}
                >
                  Complete a task
                </button>
              </div>
            </div>
          )}

          {lockCategory || form.trigger === "lesson_completed" ? (
            lockCategory ? null : (
              <div className="hours-row">
                <div className="plan-field">
                  <label htmlFor="drip-lesson-chapter">
                    <strong>Chapter</strong>
                  </label>
                  <select
                    id="drip-lesson-chapter"
                    className="select-line"
                    value={lessonChapterId}
                    onChange={(event) => {
                      onChange({ lessonId: "" });
                      onLessons?.(event.target.value);
                    }}
                  >
                    <option value="">Choose a chapter</option>
                    {chapters.map((chapter) => (
                      <option key={chapter.id} value={chapter.id}>
                        {chapter.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="plan-field">
                  <label htmlFor="drip-lesson">
                    <strong>Lesson</strong>
                  </label>
                  <select
                    id="drip-lesson"
                    className="select-line"
                    value={form.lessonId || ""}
                    onChange={(event) => onChange({ lessonId: event.target.value })}
                    disabled={!lessonChapterId}
                  >
                    <option value="">{lessonChapterId ? "Choose a lesson" : "Choose a chapter first"}</option>
                    {lessons.map((lesson) => (
                      <option key={lesson.id} value={lesson.id}>
                        {lesson.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )
          ) : (
            <div className="plan-field">
              <label htmlFor="drip-task">
                <strong>Task</strong>
              </label>
              <select
                id="drip-task"
                className="select-line"
                value={form.taskId || ""}
                onChange={(event) => onChange({ taskId: event.target.value })}
              >
                <option value="">Choose a task</option>
                {taskChapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.title}
                  </option>
                ))}
              </select>
              <p className="muted small">Sends the day they mark every lesson in that task complete.</p>
            </div>
          )}
        </>
      ) : null}

      <div className="plan-field">
        <strong>Who receives it</strong>
        <div className="drip-categories">
          <button
            type="button"
            className={`drip-chip ${form.scope === "cohort" ? "on" : ""}`}
            onClick={() => onChange({ scope: "cohort" })}
          >
            Current cohort only
          </button>
          <button
            type="button"
            className={`drip-chip ${form.scope === "static" ? "on" : ""}`}
            onClick={() => onChange({ scope: "static" })}
          >
            Current and future
          </button>
        </div>
      </div>

      <label className="muted small drip-active">
        <input
          type="checkbox"
          checked={form.isActive !== false}
          onChange={(event) => onChange({ isActive: event.target.checked })}
        />
        Active — send this automatically when the trigger is due
      </label>
    </div>
  );
}

export async function loadChapterLessonsForDrip(chapterId: string): Promise<ChapterLessonOption[]> {
  if (!chapterId) return [];
  const result = await fetchChapterLessons(chapterId);
  return result.data;
}
