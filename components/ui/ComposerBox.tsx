"use client";

import { useRef, type KeyboardEvent } from "react";
import { Bold, Underline } from "lucide-react";
import EmojiPickerButton, { insertTextAtCursor } from "@/components/ui/EmojiPicker";
import LinkInsertButton from "@/components/ui/LinkInsertButton";
import { wrapSelectedText } from "@/lib/rich-text";

export default function ComposerBox({
  id,
  value,
  onChange,
  placeholder,
  rows = 4,
  disabled = false,
  onKeyDown,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  const insertAtCursor = (insert: string) => {
    const { next, caret } = insertTextAtCursor(value, insert, fieldRef.current);
    onChange(next);
    requestAnimationFrame(() => {
      const field = fieldRef.current;
      if (!field) return;
      field.focus();
      field.setSelectionRange(caret, caret);
    });
  };

  const wrap = (before: string, after: string) => {
    const field = fieldRef.current;
    const next = wrapSelectedText(value, before, after, field?.selectionStart ?? value.length, field?.selectionEnd ?? value.length);
    onChange(next.next);
    requestAnimationFrame(() => {
      if (!field) return;
      field.focus();
      field.setSelectionRange(next.caretStart, next.caretEnd);
    });
  };

  return (
    <div className="composer-box">
      <textarea
        id={id}
        ref={fieldRef}
        rows={rows}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="composer-tools">
        <button className="ghost emoji-picker-btn" type="button" aria-label="Bold" disabled={disabled} onClick={() => wrap("**", "**")}>
          <Bold size={16} />
        </button>
        <button className="ghost emoji-picker-btn" type="button" aria-label="Underline" disabled={disabled} onClick={() => wrap("__", "__")}>
          <Underline size={16} />
        </button>
        <LinkInsertButton onInsert={insertAtCursor} disabled={disabled} />
        <EmojiPickerButton onPick={insertAtCursor} disabled={disabled} />
      </div>
    </div>
  );
}
