"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Link } from "lucide-react";
import { markdownLink } from "@/lib/rich-text";

export default function LinkInsertButton({
  onInsert,
  disabled = false,
}: {
  onInsert: (markdown: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLInputElement>(null);
  const fieldId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    requestAnimationFrame(() => labelRef.current?.focus());
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const insert = () => {
    const markdown = markdownLink(label, url);
    if (!markdown) return;
    onInsert(markdown);
    setLabel("");
    setUrl("");
    setOpen(false);
  };

  return (
    <div className="link-insert" ref={rootRef}>
      <button
        className="ghost emoji-picker-btn"
        type="button"
        aria-label="Insert link"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <Link size={18} aria-hidden="true" />
      </button>
      {open ? (
        <form
          className="link-insert-panel"
          onSubmit={(event) => {
            event.preventDefault();
            insert();
          }}
        >
          <label className="student-notes-label" htmlFor={`${fieldId}-text`}>
            Link text
          </label>
          <input
            id={`${fieldId}-text`}
            ref={labelRef}
            className="select-line"
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Lesson Title"
          />
          <label className="student-notes-label" htmlFor={`${fieldId}-url`}>
            URL
          </label>
          <input
            id={`${fieldId}-url`}
            className="select-line"
            type="text"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://iac.accountingstudyadvice.com/lessons/…"
          />
          <button className="primary" type="submit" disabled={!url.trim()}>
            Insert link
          </button>
        </form>
      ) : null}
    </div>
  );
}
