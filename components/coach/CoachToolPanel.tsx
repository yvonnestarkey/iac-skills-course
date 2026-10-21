"use client";

import type { ReactNode } from "react";

export default function CoachToolPanel({
  id,
  title,
  description,
  open,
  onToggle,
  badge,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  open: boolean;
  onToggle: () => void;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`card coach-tool ${open ? "open" : "collapsed"}`}>
      <button type="button" className="coach-tool-toggle" aria-expanded={open} onClick={onToggle}>
        <div className="coach-tool-copy">
          <h2>{title}</h2>
          {description ? <p className="muted small">{description}</p> : null}
        </div>
        {badge}
        <span className="coach-tool-chevron" aria-hidden="true">
          {open ? "−" : "+"}
        </span>
      </button>
      {open ? <div className="coach-tool-body">{children}</div> : null}
    </section>
  );
}
