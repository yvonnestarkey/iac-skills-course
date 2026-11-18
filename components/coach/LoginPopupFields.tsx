"use client";

import {
  emptyPopupActivity,
  emptyPopupCommitment,
  emptyPopupFilter,
  emptyPopupQuestion,
  POPUP_ACTIVITY_TYPES,
  POPUP_FILTER_FIELDS,
  popupFilterOptions,
  type PopupActivityType,
  type PopupFilterField,
  type PopupItem,
} from "@/lib/student-popups";
import type { DashboardPostWrite } from "@/lib/dashboard-posts";

export default function LoginPopupFields({
  form,
  lessons,
  busy,
  onChange,
}: {
  form: DashboardPostWrite;
  lessons: { id: string; title: string }[];
  busy: boolean;
  onChange: (next: Partial<DashboardPostWrite>) => void;
}) {
  const setFilter = (id: string, patch: Partial<(typeof form.filters)[number]>) => {
    onChange({
      filters: form.filters.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
    });
  };
  const setItem = (id: string, patch: Partial<PopupItem>) => {
    onChange({
      items: form.items.map((item) => (item.id === id ? ({ ...item, ...patch } as PopupItem) : item)),
    });
  };

  return (
    <div className="login-popup-fields">
      <h3>Who should see this</h3>
      <p className="muted small">Leave the filters empty to show it to everyone. Activities disappear from the pop-up once that student has done them.</p>
      <label className="student-notes-label" htmlFor="popup-filter-logic">
        Match
      </label>
      <select
        id="popup-filter-logic"
        className="select-line"
        value={form.filterLogic}
        disabled={busy}
        onChange={(event) => onChange({ filterLogic: event.target.value === "or" ? "or" : "and" })}
      >
        <option value="and">All of these filters</option>
        <option value="or">Any of these filters</option>
      </select>
      {form.filters.map((rule) => (
        <div key={rule.id} className="popup-filter-row">
          <select
            className="select-line"
            value={rule.field}
            disabled={busy}
            onChange={(event) => {
              const field = event.target.value as PopupFilterField;
              const options = popupFilterOptions(field, lessons);
              setFilter(rule.id, { field, value: options[0]?.value || "" });
            }}
          >
            {POPUP_FILTER_FIELDS.map((field) => (
              <option key={field.id} value={field.id}>
                {field.label}
              </option>
            ))}
          </select>
          <select
            className="select-line"
            value={rule.operator}
            disabled={busy}
            onChange={(event) => setFilter(rule.id, { operator: event.target.value === "is_not" ? "is_not" : "is" })}
          >
            <option value="is">is</option>
            <option value="is_not">is not</option>
          </select>
          <select
            className="select-line"
            value={rule.value}
            disabled={busy}
            onChange={(event) => setFilter(rule.id, { value: event.target.value })}
          >
            {popupFilterOptions(rule.field, lessons).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button type="button" className="ghost" disabled={busy} onClick={() => onChange({ filters: form.filters.filter((item) => item.id !== rule.id) })}>
            Remove
          </button>
        </div>
      ))}
      <p className="coaching-actions">
        <button type="button" className="ghost" disabled={busy} onClick={() => onChange({ filters: [...form.filters, emptyPopupFilter()] })}>
          Add filter
        </button>
      </p>

      <h3>Activities, commitments, and questions</h3>
      {form.items.map((item) => (
        <div key={item.id} className="popup-item-editor">
          {item.kind === "activity" ? (
            <>
              <label className="student-notes-label">Activity</label>
              <select
                className="select-line"
                value={item.activity}
                disabled={busy}
                onChange={(event) => {
                  const activity = event.target.value as (typeof POPUP_ACTIVITY_TYPES)[number]["id"];
                  const known = POPUP_ACTIVITY_TYPES.find((option) => option.id === activity);
                  setItem(item.id, { activity, label: known?.label || item.label });
                }}
              >
                {POPUP_ACTIVITY_TYPES.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              {item.activity === "lesson" ? (
                <select
                  className="select-line"
                  value={item.lessonId || ""}
                  disabled={busy}
                  onChange={(event) => setItem(item.id, { lessonId: event.target.value })}
                >
                  <option value="">Choose a lesson</option>
                  {lessons.map((lesson) => (
                    <option key={lesson.id} value={lesson.id}>
                      {lesson.title}
                    </option>
                  ))}
                </select>
              ) : null}
            </>
          ) : null}
          <label className="student-notes-label">{item.kind === "question" ? "Question" : item.kind === "commitment" ? "Commitment" : "Label"}</label>
          <input
            className="select-line"
            type="text"
            value={item.label}
            disabled={busy}
            onChange={(event) => setItem(item.id, { label: event.target.value })}
          />
          {item.kind === "commitment" ? (
            <>
              <label className="student-notes-label">Deadline (optional)</label>
              <input
                className="select-line"
                type="date"
                value={item.deadline || ""}
                disabled={busy}
                onChange={(event) => setItem(item.id, { deadline: event.target.value })}
              />
              <label className="student-notes-label">Follow-through activity (optional)</label>
              <select
                className="select-line"
                value={item.activity || ""}
                disabled={busy}
                onChange={(event) => setItem(item.id, { activity: event.target.value as PopupActivityType | "" })}
              >
                <option value="">None — just record the tick</option>
                {POPUP_ACTIVITY_TYPES.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          <button type="button" className="ghost" disabled={busy} onClick={() => onChange({ items: form.items.filter((row) => row.id !== item.id) })}>
            Remove
          </button>
        </div>
      ))}
      <p className="coaching-actions">
        <button type="button" className="ghost" disabled={busy} onClick={() => onChange({ items: [...form.items, emptyPopupActivity()] })}>
          Add activity
        </button>
        <button type="button" className="ghost" disabled={busy} onClick={() => onChange({ items: [...form.items, emptyPopupCommitment()] })}>
          Add commitment
        </button>
        <button type="button" className="ghost" disabled={busy} onClick={() => onChange({ items: [...form.items, emptyPopupQuestion()] })}>
          Add question
        </button>
      </p>
    </div>
  );
}
