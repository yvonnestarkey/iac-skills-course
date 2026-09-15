"use client";

import { useRef, type KeyboardEvent } from "react";
import EmojiPickerButton, { insertTextAtCursor } from "@/components/ui/EmojiPicker";
import LinkInsertButton from "@/components/ui/LinkInsertButton";

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
        <LinkInsertButton onInsert={insertAtCursor} disabled={disabled} />
        <EmojiPickerButton onPick={insertAtCursor} disabled={disabled} />
      </div>
    </div>
  );
}
