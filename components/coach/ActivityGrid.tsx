"use client";

import { activityHeaderGroups, type ActivityColumn } from "@/lib/activity-grid";
import { formatSastDateTime } from "@/lib/dates";
import {
  activityLevel,
  activityLevelLabel,
  type LessonEngagement,
} from "@/lib/lesson-progress";
import type { Student } from "@/lib/types";

export type ActivityStudentRow = {
  student: Student;
  byLesson: Record<string, LessonEngagement>;
};

function cellSummary(column: ActivityColumn, item?: LessonEngagement): string {
  const level = activityLevel(item);
  const date = item?.lastOpenedAt ? formatSastDateTime(item.lastOpenedAt) : "";
  const watch = item?.videoPercent ? `${item.videoPercent}% watched` : "";
  return [column.title, activityLevelLabel(level), date, watch].filter(Boolean).join(" · ");
}

export default function ActivityGrid({
  columns,
  rows,
  selectedIds,
  onToggleStudent,
  onToggleAll,
  onOpenProfile,
  selectable = true,
}: {
  columns: ActivityColumn[];
  rows: ActivityStudentRow[];
  selectedIds?: string[];
  onToggleStudent?: (id: string) => void;
  onToggleAll?: () => void;
  onOpenProfile?: (id: string) => void;
  selectable?: boolean;
}) {
  const { phases, chapters } = activityHeaderGroups(columns);
  const showPhaseRow = phases.some((phase) => phase.label);
  const headerRows = showPhaseRow ? 3 : 2;
  const chosen = selectedIds || rows.map((row) => row.student.id);
  const allSelected = rows.length > 0 && rows.every((row) => chosen.includes(row.student.id));
  const visible = rows.filter((row) => chosen.includes(row.student.id));

  if (!columns.length) {
    return <p className="empty">No published lessons to show yet.</p>;
  }

  return (
    <div className="activity-scroll" tabIndex={0}>
      <table className="activity-grid">
        <thead>
          <tr>
            <th className="activity-sticky activity-head-select" rowSpan={headerRows}>
              {selectable ? (
                <label>
                  <input type="checkbox" checked={allSelected} onChange={onToggleAll} />
                  Students
                </label>
              ) : (
                "Student"
              )}
            </th>
            {showPhaseRow
              ? phases.map((phase) => (
                  <th key={phase.key} className="activity-group" colSpan={phase.span} title={phase.title}>
                    {phase.label}
                  </th>
                ))
              : chapters.map((chapter) => (
                  <th key={chapter.key} className="activity-group activity-chapter" colSpan={chapter.span} title={chapter.title}>
                    {chapter.label}
                  </th>
                ))}
          </tr>
          {showPhaseRow ? (
          <tr>
            {chapters.map((chapter) => (
              <th key={chapter.key} className="activity-group activity-chapter" colSpan={chapter.span} title={chapter.title}>
                {chapter.label}
              </th>
            ))}
          </tr>
          ) : null}
          <tr>
            {columns.map((column) => (
              <th key={column.id} className="activity-lesson" title={column.title}>
                {column.lessonLabel}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.length ? (
            visible.map((row) => (
              <tr key={row.student.id}>
                <th className="activity-sticky activity-name">
                  {selectable ? (
                    <label>
                      <input
                        type="checkbox"
                        checked={chosen.includes(row.student.id)}
                        onChange={() => onToggleStudent?.(row.student.id)}
                      />
                      <button type="button" className="link-btn" onClick={() => onOpenProfile?.(row.student.id)}>
                        {row.student.name}
                      </button>
                    </label>
                  ) : (
                    <span>{row.student.name}</span>
                  )}
                </th>
                {columns.map((column) => {
                  const item = row.byLesson[column.id];
                  const level = activityLevel(item);
                  return (
                    <td key={`${row.student.id}-${column.id}`} title={cellSummary(column, item)}>
                      <span className={`activity-dot is-${level}`} aria-label={cellSummary(column, item)}>
                        {level === "complete" ? "✓" : level === "none" ? "" : "●"}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))
          ) : (
            <tr>
              <td className="activity-empty" colSpan={columns.length + 1}>
                Select one or more students to see their activity.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
