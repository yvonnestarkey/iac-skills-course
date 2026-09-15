"use client";

import { useEffect, useRef, useState } from "react";
import { Smile } from "lucide-react";

const EMOJIS = [
  "😀",
  "😃",
  "😄",
  "😁",
  "😊",
  "🙂",
  "😉",
  "😍",
  "🤩",
  "🤗",
  "👍",
  "👏",
  "🙌",
  "💪",
  "✅",
  "🎉",
  "✨",
  "🔥",
  "💡",
  "📌",
  "📚",
  "📝",
  "❓",
  "❗",
  "🙏",
  "❤️",
  "💛",
  "💚",
  "💙",
  "💜",
  "😅",
  "🤔",
  "😮",
  "😢",
  "😂",
  "🤝",
  "⭐",
  "🌟",
  "⏰",
  "📅",
];

export function insertTextAtCursor(
  current: string,
  insert: string,
  field: HTMLTextAreaElement | HTMLInputElement | null
): { next: string; caret: number } {
  const start = field?.selectionStart ?? current.length;
  const end = field?.selectionEnd ?? current.length;
  return {
    next: `${current.slice(0, start)}${insert}${current.slice(end)}`,
    caret: start + insert.length,
  };
}

export default function EmojiPickerButton({
  onPick,
  disabled = false,
}: {
  onPick: (emoji: string) => void;
  disabled?: boolean;
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

  return (
    <div className="emoji-picker" ref={rootRef}>
      <button
        className="ghost emoji-picker-btn"
        type="button"
        aria-label="Insert emoji"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <Smile size={18} aria-hidden="true" />
      </button>
      {open ? (
        <div className="emoji-picker-panel" role="listbox" aria-label="Emoji">
          {EMOJIS.map((emoji, index) => (
            <button
              key={`${emoji}-${index}`}
              className="emoji-picker-item"
              type="button"
              onClick={() => {
                onPick(emoji);
                setOpen(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
