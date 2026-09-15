"use client";

import {
  ROSTER_FILTER_FIELDS,
  ROSTER_FILTER_OPERATORS,
  newRosterFilterRule,
  rosterFilterFieldKind,
  type RosterFilterField,
  type RosterFilterLogic,
  type RosterFilterOperator,
  type RosterFilterRule,
} from "@/lib/roster";

interface Props {
  rules: RosterFilterRule[];
  logic: RosterFilterLogic;
  onChangeRules: (rules: RosterFilterRule[]) => void;
  onChangeLogic: (logic: RosterFilterLogic) => void;
}

export default function RosterFilterBuilder({ rules, logic, onChangeRules, onChangeLogic }: Props) {
  const updateRule = (id: string, patch: Partial<RosterFilterRule>) => {
    onChangeRules(rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
  };

  return (
    <div className="roster-rules">
      <div className="roster-rules-bar">
        <span className="muted small">Match</span>
        <div className="roster-logic" role="group" aria-label="Filter logic">
          <button
            className={logic === "and" ? "primary" : "ghost"}
            type="button"
            onClick={() => onChangeLogic("and")}
          >
            AND
          </button>
          <button className={logic === "or" ? "primary" : "ghost"} type="button" onClick={() => onChangeLogic("or")}>
            OR
          </button>
        </div>
        <button className="ghost" type="button" onClick={() => onChangeRules([...rules, newRosterFilterRule()])}>
          + Add Filter
        </button>
        {rules.length ? (
          <button className="link-btn" type="button" onClick={() => onChangeRules([])}>
            Clear all
          </button>
        ) : null}
      </div>
      {rules.map((rule) => {
        const kind = rosterFilterFieldKind(rule.field);
        const needsValue = rule.operator !== "is_empty" && rule.operator !== "is_not_empty";
        return (
          <div className="roster-rule" key={rule.id}>
            <select
              className="select-line"
              value={rule.field}
              onChange={(event) => {
                const field = event.target.value as RosterFilterField;
                const nextKind = rosterFilterFieldKind(field);
                updateRule(rule.id, {
                  field,
                  value: nextKind === "boolean" ? "true" : "",
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
              onChange={(event) => updateRule(rule.id, { operator: event.target.value as RosterFilterOperator })}
              aria-label="Filter operator"
            >
              {ROSTER_FILTER_OPERATORS.map((operator) => (
                <option key={operator.id} value={operator.id}>
                  {operator.label}
                </option>
              ))}
            </select>
            {needsValue ? (
              kind === "boolean" ? (
                <select
                  className="select-line"
                  value={rule.value || "true"}
                  onChange={(event) => updateRule(rule.id, { value: event.target.value })}
                  aria-label="Filter value"
                >
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              ) : (
                <input
                  className="select-line"
                  type="text"
                  value={rule.value}
                  onChange={(event) => updateRule(rule.id, { value: event.target.value })}
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
