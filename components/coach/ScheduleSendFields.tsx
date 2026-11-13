"use client";

import { useEffect, useState } from "react";
import { fetchChapterLessons, fetchCourseChapters, type ChapterLessonOption, type CourseChapterOption } from "@/lib/custom-surveys";
import { fetchLiveAssignmentLessons } from "@/lib/content";
import {
  SCHEDULE_MODES,
  scheduleModeLabel,
  type ScheduleFields,
  type ScheduleMode,
} from "@/lib/scheduled-sends";

export default function ScheduleSendFields({
  value,
  onChange,
  disabled = false,
}: {
  value: ScheduleFields;
  onChange: (next: ScheduleFields) => void;
  disabled?: boolean;
}) {
  const [chapters, setChapters] = useState<CourseChapterOption[]>([]);
  const [lessons, setLessons] = useState<ChapterLessonOption[]>([]);
  const [tasks, setTasks] = useState<{ id: string; title: string; chapter: string }[]>([]);
  const [chapterId, setChapterId] = useState("");

  useEffect(() => {
    void fetchCourseChapters().then((result) => setChapters(result.data));
    void fetchLiveAssignmentLessons().then((items) =>
      setTasks(items.map((lesson) => ({ id: lesson.id, title: lesson.title, chapter: lesson.chapter.title })))
    );
  }, []);

  useEffect(() => {
    if (!chapterId) {
      setLessons([]);
      return;
    }
    void fetchChapterLessons(chapterId).then((result) => setLessons(result.data));
  }, [chapterId]);

  const setMode = (mode: ScheduleMode) => onChange({ ...value, mode });

  return (
    <div className="schedule-send-fields">
      <p className="journal-field-label">When to send</p>
      <div className="drip-categories" role="tablist" aria-label="When to send">
        {SCHEDULE_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            role="tab"
            className={`drip-chip ${value.mode === mode ? "on" : ""}`}
            aria-selected={value.mode === mode}
            disabled={disabled}
            onClick={() => setMode(mode)}
          >
            {scheduleModeLabel(mode)}
          </button>
        ))}
      </div>

      {value.mode === "at_time" ? (
        <div className="schedule-send-when">
          <label>
            Date
            <input
              type="date"
              className="select-line"
              value={value.sendAtDate}
              disabled={disabled}
              onChange={(event) => onChange({ ...value, sendAtDate: event.target.value })}
            />
          </label>
          <label>
            Time (SAST)
            <input
              type="time"
              className="select-line"
              value={value.sendAtTime}
              disabled={disabled}
              onChange={(event) => onChange({ ...value, sendAtTime: event.target.value })}
            />
          </label>
        </div>
      ) : null}

      {value.mode === "lesson_completed" ? (
        <div className="schedule-send-when">
          <label>
            Chapter
            <select
              className="select-line"
              value={chapterId}
              disabled={disabled}
              onChange={(event) => {
                setChapterId(event.target.value);
                onChange({ ...value, lessonId: "" });
              }}
            >
              <option value="">Choose a chapter</option>
              {chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Lesson
            <select
              className="select-line"
              value={value.lessonId}
              disabled={disabled || !chapterId}
              onChange={(event) => onChange({ ...value, lessonId: event.target.value })}
            >
              <option value="">Choose a lesson</option>
              {lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.title}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {value.mode === "task_submitted" ? (
        <label>
          Task
          <select
            className="select-line"
            value={value.taskId}
            disabled={disabled}
            onChange={(event) => onChange({ ...value, taskId: event.target.value })}
          >
            <option value="">Choose a Task</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.chapter} · {task.title}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}
