"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";

export default function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [finePointer, setFinePointer] = useState(true);
  const rootRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();

  useEffect(() => {
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setFinePointer(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <span className="info-tooltip" ref={rootRef}>
      <button
        className="help-tooltip-icon"
        type="button"
        aria-label="About calendar subscription"
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={() => {
          if (finePointer) setOpen(true);
        }}
        onMouseLeave={() => {
          if (finePointer) setOpen(false);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          if (finePointer) setOpen(false);
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!finePointer) setOpen((current) => !current);
        }}
      >
        <Info size={16} aria-hidden="true" />
      </button>
      {open ? (
        <span className="info-tooltip-bubble" id={tooltipId} role="tooltip">
          {text}
        </span>
      ) : null}
    </span>
  );
}
