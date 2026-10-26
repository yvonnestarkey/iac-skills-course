"use client";

import { useRef } from "react";
import { Bold, Italic, Underline } from "lucide-react";
import LinkInsertButton from "@/components/ui/LinkInsertButton";
import { wrapSelectedText } from "@/lib/rich-text";

export default function RichTextField({
  id,
  value,
  onChange,
  rows = 4,
  placeholder,
  hint,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  hint?: string;
}) {
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  const wrap = (before: string, after: string) => {
    const field = fieldRef.current;
    const start = field?.selectionStart ?? value.length;
    const end = field?.selectionEnd ?? value.length;
    const next = wrapSelectedText(value, before, after, start, end);
    onChange(next.next);
    requestAnimationFrame(() => {
      if (!field) return;
      field.focus();
      field.setSelectionRange(next.caretStart, next.caretEnd);
    });
  };

  const insert = (text: string) => {
    const field = fieldRef.current;
    const start = field?.selectionStart ?? value.length;
    const end = field?.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${text}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      if (!field) return;
      field.focus();
      const caret = start + text.length;
      field.setSelectionRange(caret, caret);
    });
  };

  return (
    <div className="rich-text-field">
      <div className="rich-text-toolbar" role="toolbar" aria-label="Text formatting">
        <button className="ghost" type="button" aria-label="Bold" onClick={() => wrap("**", "**")}>
          <Bold size={16} />
        </button>
        <button className="ghost" type="button" aria-label="Italic" onClick={() => wrap("*", "*")}>
          <Italic size={16} />
        </button>
        <button className="ghost" type="button" aria-label="Underline" onClick={() => wrap("__", "__")}>
          <Underline size={16} />
        </button>
        <LinkInsertButton onInsert={insert} />
      </div>
      <textarea
        id={id}
        ref={fieldRef}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? <p className="muted small">{hint}</p> : null}
    </div>
  );
}
