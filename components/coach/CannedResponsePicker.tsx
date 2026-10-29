"use client";

import { useEffect, useMemo, useState } from "react";
import {
  applyCannedResponse,
  deleteFeedbackTemplate,
  fetchFeedbackTemplates,
  saveFeedbackTemplate,
  suggestedTemplateGroup,
  TEMPLATE_GROUPS,
  templatesInGroup,
  type FeedbackTemplate,
} from "@/lib/feedback-templates";

export default function CannedResponsePicker({
  lessonTitle,
  value,
  onChange,
}: {
  lessonTitle: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const [templates, setTemplates] = useState<FeedbackTemplate[]>([]);
  const [group, setGroup] = useState(() => suggestedTemplateGroup(lessonTitle));
  const [templateId, setTemplateId] = useState("");
  const [saveTitle, setSaveTitle] = useState("");
  const [saveGroup, setSaveGroup] = useState(() => suggestedTemplateGroup(lessonTitle));
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const suggested = suggestedTemplateGroup(lessonTitle);
    setGroup(suggested);
    setSaveGroup(suggested);
  }, [lessonTitle]);

  useEffect(() => {
    let cancelled = false;
    fetchFeedbackTemplates().then((rows) => {
      if (cancelled) return;
      setTemplates(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => {
    const extra = templates.map((item) => item.group).filter((item) => !TEMPLATE_GROUPS.includes(item as (typeof TEMPLATE_GROUPS)[number]));
    return [...TEMPLATE_GROUPS, ...[...new Set(extra)]];
  }, [templates]);

  const inGroup = templatesInGroup(templates, group);
  const selected = inGroup.find((item) => item.id === templateId) || inGroup[0] || null;

  useEffect(() => {
    if (!inGroup.some((item) => item.id === templateId)) {
      setTemplateId(inGroup[0]?.id || "");
    }
  }, [group, inGroup, templateId]);

  const insert = (mode: "replace" | "append") => {
    if (!selected) return;
    onChange(applyCannedResponse(value, selected.body, mode));
    setNotice(mode === "replace" ? "Canned response loaded. Edit it before you send." : "Canned response added below your comments.");
  };

  const saveCurrent = async () => {
    setBusy(true);
    setNotice("");
    const result = await saveFeedbackTemplate({
      group: saveGroup,
      title: saveTitle,
      body: value,
    });
    setBusy(false);
    if (!result.ok || !result.template) {
      setNotice(result.error || "Could not save that canned response.");
      return;
    }
    setTemplates((current) => [...current, result.template!]);
    setSaveTitle("");
    setGroup(result.template.group);
    setTemplateId(result.template.id);
    setNotice("Saved. It will be in the list next time you mark this kind of answer.");
  };

  const remove = async (id: string) => {
    setBusy(true);
    const result = await deleteFeedbackTemplate(id);
    setBusy(false);
    if (!result.ok) {
      setNotice(result.error || "Could not remove that canned response.");
      return;
    }
    setTemplates((current) => current.filter((item) => item.id !== id));
    setNotice("Removed.");
  };

  const custom = templates.filter((item) => item.custom);

  return (
    <div className="canned-responses">
      <p className="student-notes-label">Start from a canned response</p>
      <p className="muted small">Pick a starting reply for this kind of answer, then edit it in the page below.</p>
      <div className="canned-responses-row">
        <label className="canned-field">
          <span>Type</span>
          <select className="select-line" value={group} onChange={(event) => setGroup(event.target.value)}>
            {groups.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="canned-field canned-field-wide">
          <span>Canned response</span>
          <select className="select-line" value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
            {inGroup.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
        <div className="actions canned-actions">
          <button className="primary" type="button" disabled={!selected} onClick={() => insert("replace")}>
            Use this
          </button>
          <button className="ghost" type="button" disabled={!selected || !value.trim()} onClick={() => insert("append")}>
            Add below
          </button>
        </div>
      </div>

      <details className="canned-save">
        <summary>Save the comments below as a new canned response</summary>
        <p className="muted small">Use this when you write a reply you will need again for the same kind of answer.</p>
        <div className="canned-responses-row">
          <label className="canned-field">
            <span>Type</span>
            <select className="select-line" value={saveGroup} onChange={(event) => setSaveGroup(event.target.value)}>
              {groups.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="canned-field canned-field-wide">
            <span>Name</span>
            <input
              className="select-line"
              value={saveTitle}
              onChange={(event) => setSaveTitle(event.target.value)}
              placeholder="e.g. Variances — numbers don’t speak"
            />
          </label>
          <button className="ghost" type="button" disabled={busy || !value.trim()} onClick={() => void saveCurrent()}>
            {busy ? "Saving…" : "Save canned"}
          </button>
        </div>
        {custom.length ? (
          <ul className="canned-custom-list">
            {custom.map((item) => (
              <li key={item.id}>
                <span>
                  {item.group} · {item.title}
                </span>
                <button className="ghost" type="button" disabled={busy} onClick={() => void remove(item.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </details>
      {notice ? <p className="muted small">{notice}</p> : null}
    </div>
  );
}
