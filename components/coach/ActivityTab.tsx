"use client";

import { useEffect, useMemo, useState } from "react";
import ActivityGrid, { type ActivityStudentRow } from "@/components/coach/ActivityGrid";
import ActivityMessageModal from "@/components/coach/ActivityMessageModal";
import RosterFilterBuilder from "@/components/coach/RosterFilterBuilder";
import { activityColumnsFromOutline } from "@/lib/activity-grid";
import { COURSE_COHORTS } from "@/lib/cohorts";
import { labelForGroup } from "@/lib/comms";
import { cohortName } from "@/lib/course";
import { courseAccessLabel } from "@/lib/course-access";
import { coachSentStatsByStudentId, fetchCoachSentMessages, type CoachSentMessageStat } from "@/lib/inbox";
import { engagementByLesson, type CoachProgressBundle } from "@/lib/lesson-progress";
import {
  buildRosterFilterOptions,
  cleanRosterOptionValue,
  matchesRosterStudent,
  newRosterFilterRule,
  type RosterFilterLogic,
  type RosterFilterRule,
} from "@/lib/roster";
import { useStore } from "@/lib/store";
import type { OutlineChapter } from "@/lib/student-lesson";
import type { Student } from "@/lib/types";

export default function ActivityTab({
  students,
  optionStudents,
  outline,
  progress,
  onOpenProfile,
}: {
  students: Student[];
  optionStudents?: Student[];
  outline: OutlineChapter[];
  progress: CoachProgressBundle | null;
  onOpenProfile: (id: string) => void;
}) {
  const { data, setNotifyDraft, setNotice } = useStore();
  const columns = useMemo(() => activityColumnsFromOutline(outline), [outline]);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [rules, setRules] = useState<RosterFilterRule[]>([]);
  const [logic, setLogic] = useState<RosterFilterLogic>("and");
  const [messageStats, setMessageStats] = useState<Record<string, CoachSentMessageStat>>({});
  const [composeOpen, setComposeOpen] = useState(false);

  const loadSent = () => {
    fetchCoachSentMessages().then((result) => {
      if (!result.ok) return;
      setMessageStats(
        coachSentStatsByStudentId(
          result.data,
          students.map((student) => ({ id: student.id, email: student.email }))
        )
      );
    });
  };

  useEffect(() => {
    let cancelled = false;
    fetchCoachSentMessages().then((result) => {
      if (cancelled || !result.ok) return;
      setMessageStats(
        coachSentStatsByStudentId(
          result.data,
          students.map((student) => ({ id: student.id, email: student.email }))
        )
      );
    });
    return () => {
      cancelled = true;
    };
  }, [students]);

  const optionsByField = useMemo(() => {
    const source = optionStudents || students;
    const cohortDefaults = COURSE_COHORTS.map((cohort) => ({ value: cohort.id, label: cohort.name })).filter(
      (option) => Boolean(cleanRosterOptionValue(option.value) && cleanRosterOptionValue(option.label))
    );
    return buildRosterFilterOptions({
      students: source,
      cohortDefaults,
      cohortLabel: (value) => cohortName(data, value),
      courseAccessLabel: (value) =>
        value === "deregistered" ? "Deregistered" : courseAccessLabel(value === "full" ? "full" : "free_preview"),
    });
  }, [data, optionStudents, students]);

  const filtered = useMemo(
    () => students.filter((student) => matchesRosterStudent(student, { search: query, rules, logic })),
    [logic, query, rules, students]
  );

  const rows = useMemo<ActivityStudentRow[]>(
    () =>
      filtered.map((student) => ({
        student,
        byLesson: engagementByLesson(progress?.byUser[student.id]?.lessons),
      })),
    [filtered, progress]
  );

  const visibleIds = filtered.map((student) => student.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const selectedVisible = selectedIds.filter((id) => visibleIds.includes(id));
  const actionStudents = selectedVisible.length
    ? filtered.filter((student) => selectedVisible.includes(student.id))
    : filtered;
  const actionCount = actionStudents.length;
  const usingSelection = selectedVisible.length > 0;

  const toggleStudent = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const notifyStudents = () => {
    if (!actionStudents.length) return;
    setNotifyDraft({
      audience: usingSelection ? "selected" : "filtered",
      audienceLabel: labelForGroup(
        data,
        actionStudents,
        usingSelection ? "selected" : "filtered",
        usingSelection ? undefined : "Activity"
      ),
      recipientIds: actionStudents.map((student) => student.id),
    });
  };

  return (
    <section className="card activity-panel">
      <div className="panel-head">
        <div>
          <h2>Activity</h2>
          <p className="muted small">
            All students are shown. Use the roster filters to find a group, tick names, then Message (inbox) or Notify
            (announcement). Name colour runs red to green with how far they have got. Hover Last login or Messages for
            dates.
          </p>
        </div>
        <div className="actions">
          <button className="primary" type="button" disabled={!actionCount} onClick={() => setComposeOpen(true)}>
            Message {usingSelection ? "selected" : "visible"} ({actionCount})
          </button>
          <button className="ghost" type="button" disabled={!actionCount} onClick={notifyStudents}>
            Notify {usingSelection ? "selected" : "visible"} ({actionCount})
          </button>
        </div>
      </div>
      <div className="activity-toolbar">
        <input
          className="select-line roster-search"
          type="search"
          placeholder="Search name, email, or phone"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search students"
        />
        <button
          type="button"
          className="ghost"
          onClick={() =>
            setSelectedIds(
              allVisibleSelected
                ? selectedIds.filter((id) => !visibleIds.includes(id))
                : [...new Set([...selectedIds, ...visibleIds])]
            )
          }
        >
          {allVisibleSelected ? "Clear visible" : "Select visible"}
        </button>
        <button type="button" className="ghost" onClick={() => setSelectedIds(students.map((student) => student.id))}>
          Select all
        </button>
        <span className="muted small">
          {selectedVisible.length} selected · {filtered.length} of {students.length} students
        </span>
      </div>
      <RosterFilterBuilder
        rules={rules}
        logic={logic}
        optionsByField={optionsByField}
        onChangeRules={setRules}
        onChangeLogic={setLogic}
        onAddRule={() => setRules((current) => [...current, newRosterFilterRule()])}
      />
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
        <span className="activity-heat-legend">
          <i className="activity-heat-swatch" /> Name colour: red little progress, green completing work
        </span>
      </div>
      <ActivityGrid
        columns={columns}
        rows={rows}
        selectedIds={selectedIds}
        onToggleStudent={toggleStudent}
        onToggleAll={() =>
          setSelectedIds(
            allVisibleSelected
              ? selectedIds.filter((id) => !visibleIds.includes(id))
              : [...new Set([...selectedIds, ...visibleIds])]
          )
        }
        onOpenProfile={onOpenProfile}
        messageStats={messageStats}
      />
      {composeOpen ? (
        <ActivityMessageModal
          students={actionStudents}
          onClose={() => setComposeOpen(false)}
          onSent={(sent) => {
            loadSent();
            setNotice(`Sent an inbox message to ${sent} student${sent === 1 ? "" : "s"}.`);
          }}
        />
      ) : null}
    </section>
  );
}
