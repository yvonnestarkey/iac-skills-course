"use client";

import Link from "next/link";
import {
  activityHeaderGroups,
  engagementHeat,
  lastCourseVisitAt,
  lastCourseVisitLabel,
  type ActivityColumn,
} from "@/lib/activity-grid";
import { formatSastDateTime } from "@/lib/dates";
import {
  EMPTY_COACH_SENT_STAT,
  studentMessagesHref,
  type CoachSentMessageStat,
} from "@/lib/inbox";
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
  messageStats = {},
}: {
  columns: ActivityColumn[];
  rows: ActivityStudentRow[];
  selectedIds?: string[];
  onToggleStudent?: (id: string) => void;
  onToggleAll?: () => void;
  onOpenProfile?: (id: string) => void;
  selectable?: boolean;
  messageStats?: Record<string, CoachSentMessageStat>;
}) {
  const { phases, chapters } = activityHeaderGroups(columns);
  const showPhaseRow = phases.some((phase) => phase.label);
  const headerRows = showPhaseRow ? 3 : 2;
  const chosen = selectedIds || [];
  const allSelected = rows.length > 0 && rows.every((row) => chosen.includes(row.student.id));
  const stickyCols = 3;

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
            <th className="activity-sticky activity-head-messages" rowSpan={headerRows}>
              Messages
            </th>
            <th className="activity-sticky activity-head-login" rowSpan={headerRows} title="Last time they were in the course">
              Last login
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
          {rows.length ? (
            rows.map((row) => {
              const stat = messageStats[row.student.id] || EMPTY_COACH_SENT_STAT;
              const last = stat.lastAt ? `Last sent ${formatSastDateTime(stat.lastAt)}` : "No messages sent yet";
              const heat = engagementHeat(columns, row.byLesson);
              const visit = lastCourseVisitLabel(lastCourseVisitAt(row.student.lastActive, row.byLesson));
              return (
              <tr key={row.student.id}>
                <th
                  className="activity-sticky activity-name is-heat"
                  style={{ background: heat.background }}
                  title={heat.label}
                >
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
                <td className="activity-sticky activity-messages">
                  <Link
                    href={studentMessagesHref(row.student.id)}
                    className="activity-messages-link"
                    title={`${stat.count} sent · ${last}`}
                  >
                    {stat.count}
                  </Link>
                </td>
                <td className="activity-sticky activity-login" title={visit.title}>
                  {visit.text}
                </td>
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
              );
            })
          ) : (
            <tr>
              <td className="activity-empty" colSpan={columns.length + stickyCols}>
                No students match these filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
