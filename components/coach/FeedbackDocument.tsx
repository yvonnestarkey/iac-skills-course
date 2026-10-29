"use client";

import { useRef } from "react";
import { Bold, Italic, List, ListOrdered, Underline } from "lucide-react";
import EmojiPickerButton, { insertTextAtCursor } from "@/components/ui/EmojiPicker";
import LinkInsertButton from "@/components/ui/LinkInsertButton";
import { wrapSelectedText } from "@/lib/rich-text";

function prefixSelectedLines(
  value: string,
  start: number,
  end: number,
  marker: string
): { next: string; caretStart: number; caretEnd: number } {
  const from = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const to = end;
  const chunk = value.slice(from, to) || "";
  const lines = (chunk || "").split("\n");
  const nextChunk = lines
    .map((line) => {
      if (!line.trim()) return line;
      if (line.startsWith(marker)) return line;
      return `${marker}${line}`;
    })
    .join("\n");
  const next = `${value.slice(0, from)}${nextChunk}${value.slice(to)}`;
  return { next, caretStart: from, caretEnd: from + nextChunk.length };
}

export default function FeedbackDocument({
  id,
  value,
  onChange,
  placeholder,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  const apply = (next: string, caretStart: number, caretEnd: number) => {
    onChange(next);
    requestAnimationFrame(() => {
      const field = fieldRef.current;
      if (!field) return;
      field.focus();
      field.setSelectionRange(caretStart, caretEnd);
    });
  };

  const wrap = (before: string, after: string) => {
    const field = fieldRef.current;
    const result = wrapSelectedText(
      value,
      before,
      after,
      field?.selectionStart ?? value.length,
      field?.selectionEnd ?? value.length
    );
    apply(result.next, result.caretStart, result.caretEnd);
  };

  const list = (marker: string) => {
    const field = fieldRef.current;
    const result = prefixSelectedLines(
      value,
      field?.selectionStart ?? value.length,
      field?.selectionEnd ?? value.length,
      marker
    );
    apply(result.next, result.caretStart, result.caretEnd);
  };

  const insertAtCursor = (insert: string) => {
    const { next, caret } = insertTextAtCursor(value, insert, fieldRef.current);
    apply(next, caret, caret);
  };

  return (
    <div className="feedback-document">
      <div className="feedback-document-toolbar" role="toolbar" aria-label="Formatting">
        <button className="ghost" type="button" aria-label="Bold" onClick={() => wrap("**", "**")}>
          <Bold size={16} />
          Bold
        </button>
        <button className="ghost" type="button" aria-label="Italic" onClick={() => wrap("*", "*")}>
          <Italic size={16} />
          Italic
        </button>
        <button className="ghost" type="button" aria-label="Underline" onClick={() => wrap("__", "__")}>
          <Underline size={16} />
          Underline
        </button>
        <button className="ghost" type="button" aria-label="Bullet list" onClick={() => list("- ")}>
          <List size={16} />
          List
        </button>
        <button className="ghost" type="button" aria-label="Numbered list" onClick={() => list("1. ")}>
          <ListOrdered size={16} />
          Numbered
        </button>
        <LinkInsertButton onInsert={insertAtCursor} />
        <EmojiPickerButton onPick={insertAtCursor} />
      </div>
      <textarea
        id={id}
        ref={fieldRef}
        className="feedback-document-page"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        spellCheck
      />
    </div>
  );
}
