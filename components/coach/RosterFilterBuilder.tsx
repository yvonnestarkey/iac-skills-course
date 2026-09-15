"use client";

import { useEffect, useRef, useState } from "react";
import {
  ROSTER_FILTER_FIELDS,
  defaultOperatorForField,
  operatorsForField,
  rosterFilterFieldKind,
  type RosterFilterField,
  type RosterFilterLogic,
  type RosterFilterOperator,
  type RosterFilterOption,
  type RosterFilterRule,
} from "@/lib/roster";

interface Props {
  rules: RosterFilterRule[];
  logic: RosterFilterLogic;
  optionsByField: Partial<Record<RosterFilterField, RosterFilterOption[]>>;
  onChangeRules: (rules: RosterFilterRule[]) => void;
  onChangeLogic: (logic: RosterFilterLogic) => void;
  onAddRule: () => void;
}

function MultiSelect({
  options,
  selected,
  onChange,
}: {
  options: RosterFilterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const label = selected.length
    ? selected.length === 1
      ? options.find((option) => option.value === selected[0])?.label || selected[0]
      : `${selected.length} selected`
    : "Select…";

  return (
    <div className="roster-multiselect" ref={rootRef}>
      <button className="select-line roster-multiselect-btn" type="button" onClick={() => setOpen((current) => !current)}>
        {label}
      </button>
      {open ? (
        <div className="roster-multiselect-panel">
          {options.length ? (
            options.map((option) => {
              const checked = selected.includes(option.value);
              return (
                <label className="roster-check" key={option.value}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      onChange(checked ? selected.filter((value) => value !== option.value) : [...selected, option.value])
                    }
                  />
                  {option.label}
                </label>
              );
            })
          ) : (
            <p className="muted small">No values in the current roster.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function RosterFilterBuilder({
  rules,
  logic,
  optionsByField,
  onChangeRules,
  onChangeLogic,
  onAddRule,
}: Props) {
  const updateRule = (id: string, patch: Partial<RosterFilterRule>) => {
    onChangeRules(rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
  };

  return (
    <div className="roster-rules">
      <div className="roster-rules-bar">
        <span className="muted small">Match</span>
        <div className="roster-logic" role="group" aria-label="Filter logic">
          <button className={logic === "and" ? "primary" : "ghost"} type="button" onClick={() => onChangeLogic("and")}>
            AND
          </button>
          <button className={logic === "or" ? "primary" : "ghost"} type="button" onClick={() => onChangeLogic("or")}>
            OR
          </button>
        </div>
        <button className="ghost" type="button" onClick={onAddRule}>
          + Add Filter
        </button>
        {rules.length ? (
          <button className="link-btn" type="button" onClick={() => onChangeRules([])}>
            Clear all
          </button>
        ) : null}
      </div>
      {rules.map((rule, index) => {
        const kind = rosterFilterFieldKind(rule.field);
        const operators = operatorsForField(rule.field);
        const options = optionsByField[rule.field] || [];
        const needsValue = rule.operator !== "is_empty";
        return (
          <div className="roster-rule" key={rule.id}>
            <span className="roster-rule-join">{index === 0 ? "" : logic.toUpperCase()}</span>
            <select
              className="select-line"
              value={rule.field}
              onChange={(event) => {
                const field = event.target.value as RosterFilterField;
                const nextKind = rosterFilterFieldKind(field);
                updateRule(rule.id, {
                  field,
                  operator: defaultOperatorForField(field),
                  values: nextKind === "boolean" ? ["true"] : [],
                });
              }}
              aria-label="Filter field"
            >
              {ROSTER_FILTER_FIELDS.map((field) => (
                <option key={field.id} value={field.id}>
                  {field.label}
                </option>
              ))}
            </select>
            <select
              className="select-line"
              value={rule.operator}
              onChange={(event) => updateRule(rule.id, { operator: event.target.value as RosterFilterOperator, values: [] })}
              aria-label="Filter operator"
            >
              {operators.map((operator) => (
                <option key={operator.id} value={operator.id}>
                  {operator.label}
                </option>
              ))}
            </select>
            {needsValue ? (
              kind === "boolean" ? (
                <select
                  className="select-line"
                  value={rule.values[0] || "true"}
                  onChange={(event) => updateRule(rule.id, { values: [event.target.value] })}
                  aria-label="Filter value"
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              ) : kind === "categorical" && rule.operator === "is_any_of" ? (
                <MultiSelect
                  options={options}
                  selected={rule.values}
                  onChange={(values) => updateRule(rule.id, { values })}
                />
              ) : kind === "categorical" ? (
                <select
                  className="select-line"
                  value={rule.values[0] || ""}
                  onChange={(event) => updateRule(rule.id, { values: event.target.value ? [event.target.value] : [] })}
                  aria-label="Filter value"
                >
                  <option value="">Select…</option>
                  {options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="select-line"
                  type="text"
                  value={rule.values[0] || ""}
                  onChange={(event) => updateRule(rule.id, { values: [event.target.value] })}
                  placeholder="Value"
                  aria-label="Filter value"
                />
              )
            ) : (
              <span className="muted small roster-rule-skip">No value needed</span>
            )}
            <button
              className="ghost"
              type="button"
              onClick={() => onChangeRules(rules.filter((item) => item.id !== rule.id))}
              aria-label="Remove filter"
            >
              Remove
            </button>
          </div>
        );
      })}
    </div>
  );
}
