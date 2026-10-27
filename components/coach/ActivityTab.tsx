"use client";

import { useEffect, useMemo, useState } from "react";
import ActivityGrid, { type ActivityStudentRow } from "@/components/coach/ActivityGrid";
import { activityColumnsFromOutline } from "@/lib/activity-grid";
import { engagementByLesson, type CoachProgressBundle } from "@/lib/lesson-progress";
import type { OutlineChapter } from "@/lib/student-lesson";
import type { Student } from "@/lib/types";

export default function ActivityTab({
  students,
  outline,
  progress,
  onOpenProfile,
}: {
  students: Student[];
  outline: OutlineChapter[];
  progress: CoachProgressBundle | null;
  onOpenProfile: (id: string) => void;
}) {
  const columns = useMemo(() => activityColumnsFromOutline(outline), [outline]);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    const ids = students.map((student) => student.id);
    setSelectedIds((current) => {
      if (!current.length) return ids;
      const keep = current.filter((id) => ids.includes(id));
      return keep.length ? keep : ids;
    });
  }, [students]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return students.filter((student) => {
      if (!needle) return true;
      return student.name.toLowerCase().includes(needle) || student.email.toLowerCase().includes(needle);
    });
  }, [query, students]);

  const rows = useMemo<ActivityStudentRow[]>(
    () =>
      filtered.map((student) => ({
        student,
        byLesson: engagementByLesson(progress?.byUser[student.id]?.lessons),
      })),
    [filtered, progress]
  );

  const toggleStudent = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const visibleIds = filtered.map((student) => student.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  return (
    <section className="card activity-panel">
      <div className="panel-head">
        <div>
          <h2>Activity</h2>
          <p className="muted small">
            Green is complete, yellow is about halfway, red is a brief click. Hover a block for the date and watch
            percent, or a lesson number for the title.
          </p>
        </div>
      </div>
      <div className="activity-toolbar">
        <input
          type="search"
          placeholder="Find a student…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          type="button"
          className="ghost"
          onClick={() => setSelectedIds(allVisibleSelected ? selectedIds.filter((id) => !visibleIds.includes(id)) : [...new Set([...selectedIds, ...visibleIds])])}
        >
          {allVisibleSelected ? "Clear visible" : "Select visible"}
        </button>
        <button type="button" className="ghost" onClick={() => setSelectedIds(students.map((student) => student.id))}>
          Select all
        </button>
        <span className="muted small">
          {selectedIds.filter((id) => students.some((student) => student.id === id)).length} of {students.length}{" "}
          students
        </span>
      </div>
      <div className="activity-legend" aria-hidden="true">
        <span>
          <i className="activity-dot is-complete">✓</i> Complete
        </span>
        <span>
          <i className="activity-dot is-partial">●</i> Partial
        </span>
        <span>
          <i className="activity-dot is-click">●</i> Clicked briefly
        </span>
        <span>
          <i className="activity-dot is-none" /> Not started
        </span>
      </div>
      <ActivityGrid
        columns={columns}
        rows={rows}
        selectedIds={selectedIds}
        onToggleStudent={toggleStudent}
        onToggleAll={() =>
          setSelectedIds(allVisibleSelected ? selectedIds.filter((id) => !visibleIds.includes(id)) : [...new Set([...selectedIds, ...visibleIds])])
        }
        onOpenProfile={onOpenProfile}
      />
    </section>
  );
}
