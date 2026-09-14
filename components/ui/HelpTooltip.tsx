"use client";

import { useEffect, useId, useState } from "react";
import type { MouseEvent } from "react";
import { createPortal } from "react-dom";
import { CircleHelp, X } from "lucide-react";
import { fetchHelpContent, type HelpContent } from "@/lib/help-content";
import { embedSrcForVideo } from "@/components/lesson/VideoPlayer";

export default function HelpTooltip({ contentKey }: { contentKey: string }) {
  const [content, setContent] = useState<HelpContent | null>(null);
  const [hover, setHover] = useState(false);
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    let cancelled = false;
    fetchHelpContent(contentKey).then((row) => {
      if (!cancelled) setContent(row);
    });
    return () => {
      cancelled = true;
    };
  }, [contentKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onIconClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setHover(false);
    setOpen(true);
  };

  if (!content) return null;

  const embedSrc = embedSrcForVideo(content.video_url || undefined);
  const paragraphs = content.description
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return (
    <span className="help-tooltip">
      <button
        className="help-tooltip-icon"
        type="button"
        aria-label="What is this?"
        aria-expanded={open}
        aria-haspopup="dialog"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        onClick={onIconClick}
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <CircleHelp size={16} aria-hidden="true" />
      </button>
      {hover && !open ? (
        <span className="help-tooltip-hint" role="tooltip">
          What is this?
        </span>
      ) : null}
      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="help-drawer-backdrop" onClick={() => setOpen(false)}>
              <aside
                className="help-drawer"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="help-drawer-bar">
                  <h2 id={titleId}>{content.title}</h2>
                  <button className="ghost" type="button" onClick={() => setOpen(false)}>
                    <X size={16} />
                    Close
                  </button>
                </div>
                {paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {embedSrc ? (
                  <div className="help-drawer-video">
                    <iframe title={content.title} src={embedSrc} allow="autoplay; fullscreen" allowFullScreen />
                  </div>
                ) : null}
              </aside>
            </div>,
            document.body
          )
        : null}
    </span>
  );
}
