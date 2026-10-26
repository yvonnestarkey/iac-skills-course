"use client";

import { useEffect, useMemo, useState } from "react";
import { gradeBand, shuffledIndexes } from "@/lib/reading-drills";

export const fmt = (seconds: number): string => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Steps along the top, plus the running clock (elapsed, or a countdown when `countdownFrom` is set). */
export function StepStrip({ names, step, t0, countdownFrom, countdownStart }: {
  names: string[];
  step: number;
  t0: number | null;
  countdownFrom?: number;
  countdownStart?: number | null;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);
  let label = "0:00";
  let over = false;
  if (countdownFrom && countdownStart) {
    const left = countdownFrom - (Date.now() - countdownStart) / 1000;
    label = `${left < 0 ? "+" : ""}${fmt(Math.abs(left))}`;
    over = left < 0;
  } else if (t0) {
    label = fmt((Date.now() - t0) / 1000);
  }
  return (
    <div className="rd-strip">
      <div className="rd-steps">
        {names.map((n, i) => (
          <span key={n} className={i === step ? "on" : i < step ? "done" : ""}>
            {i + 1} {n}
          </span>
        ))}
      </div>
      <span className={`rd-clock${over ? " over" : ""}`} aria-label="Clock">
        {label}
      </span>
    </div>
  );
}

/** Multiple choice with a fixed shuffled order per run. Value = original option index. */
export function Choice({ name, options, seed, multi = false, value, onChange }: {
  name: string;
  options: string[];
  seed: number;
  multi?: boolean;
  value: number | number[] | null;
  onChange: (value: number | number[]) => void;
}) {
  const order = useMemo(() => shuffledIndexes(options.length, seed), [options.length, seed]);
  const picked = (i: number) => (multi ? (value as number[] | null)?.includes(i) : value === i);
  return (
    <div className="rd-opts">
      {order.map((i) => (
        <label key={i} className={`rd-opt${picked(i) ? " on" : ""}`}>
          <input
            type={multi ? "checkbox" : "radio"}
            name={name}
            checked={Boolean(picked(i))}
            onChange={() => {
              if (!multi) return onChange(i);
              const cur = new Set((value as number[] | null) || []);
              if (cur.has(i)) cur.delete(i);
              else cur.add(i);
              onChange([...cur]);
            }}
          />
          <span>{options[i]}</span>
        </label>
      ))}
    </div>
  );
}

export function Pill({ value }: { value: "yes" | "partly" | "no" }) {
  return <span className={`rd-pill ${value}`}>{value[0].toUpperCase() + value.slice(1)}</span>;
}

/** The estimated range against the 50% pass line. */
export function ResultRange({ pct, potPct }: { pct: number; potPct: number }) {
  const g = gradeBand(pct);
  const p = gradeBand(potPct);
  return (
    <section className="rd-result" aria-label="Estimated result">
      <span className="rd-eyebrow">Estimated result on this question</span>
      <div className="rd-row">
        <span className="rd-range">{g.label}</span>
        <span className={`rd-pill ${g.pass ? "yes" : g.lo === 40 ? "partly" : "no"}`}>{g.verdict}</span>
      </div>
      <div className="rd-scale" aria-hidden="true">
        <span className="band" style={{ left: `${g.lo}%`, width: `${g.hi - g.lo}%` }} />
        {p.lo > g.lo ? <span className="pot" style={{ left: `${p.lo}%`, width: `${p.hi - p.lo}%` }} /> : null}
        <span className="pass" />
      </div>
      <div className="rd-scale-l">
        <span>0%</span>
        <span>Pass 50%</span>
        <span>100%</span>
      </div>
      {p.lo > g.lo ? (
        <p className="muted small">
          Turning the clues you noted into points would have put you in the <b>{p.label}</b> range.
        </p>
      ) : null}
      <p className="muted small">An estimate from one short question, against the 50% you need, not a mark.</p>
    </section>
  );
}

export function Tile({ label, big, sub }: { label: string; big: React.ReactNode; sub: React.ReactNode }) {
  return (
    <div className="rd-tile">
      <span className="rd-eyebrow">{label}</span>
      <span className="rd-big">{big}</span>
      <span className="muted small">{sub}</span>
    </div>
  );
}
