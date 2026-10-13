"use client";

import { useEffect, useState } from "react";
import { formatUsdCents } from "@/lib/format-money";

type PartnerRow = {
  id: string;
  name: string;
  code: string;
  rate_bps: number;
  payout: string;
  owed_cents: number;
  successful_count: number;
};

type StudentRow = {
  user_id: string;
  name: string;
  email: string;
  code: string;
  earned_cents: number;
  successful_count: number;
};

type SuccessRow = {
  id: string;
  at: string;
  referrer_name: string;
  referrer_kind: "student" | "professional";
  code: string;
  referee_name: string;
  referee_email: string;
  amount_cents: number;
  payout: string;
  status: string;
  rate_label: string;
};

type Payload = {
  partners: PartnerRow[];
  students: StudentRow[];
  successes: SuccessRow[];
};

function money(cents: number) {
  return formatUsdCents(cents);
}

function when(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
}

export default function CoachReferralsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/coach/referrals")
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not load referrals.");
        setData(payload);
      })
      .catch((item) => setError(item instanceof Error ? item.message : "Could not load referrals."));
  }, []);

  return (
    <div className="coach-page">
      <section className="card">
        <p className="kicker">Coach tools</p>
        <h1>Referrals</h1>
        <p className="muted">
          Successful referrals from students and professional colleagues. Student credit stays on their account.
          Colleague payouts are a record only — pay those separately.
        </p>
        {error ? <p className="student-auth-error">{error}</p> : null}
        {!data ? <p className="empty">Loading referrals…</p> : null}
      </section>

      {data ? (
        <>
          <section className="card">
            <h2>Professional colleagues</h2>
            <p className="muted small">
              Roelien is first. Students who use her code get 5% off. She is owed 15% of the course price, paid separately.
            </p>
            <div className="work-list">
              {data.partners.map((partner) => (
                <article className="work-item" key={partner.id}>
                  <div className="work-head">
                    <strong>{partner.name}</strong>
                    <span className="muted small">{partner.successful_count} successful</span>
                  </div>
                  <p>
                    Code <strong>{partner.code}</strong>
                  </p>
                  <p className="muted small">
                    Student 5% off · {partner.rate_bps / 100}% of course price owed to {partner.name} · {money(partner.owed_cents)} · pay separately
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="card">
            <h2>Students</h2>
            {data.students.length ? (
              <div className="work-list">
                {data.students.map((student) => (
                  <article className="work-item" key={student.user_id}>
                    <div className="work-head">
                      <strong>{student.name}</strong>
                      <span className="muted small">{student.successful_count} successful</span>
                    </div>
                    <p className="muted small">{student.email}</p>
                    <p>
                      Code <strong>{student.code || "—"}</strong>
                    </p>
                    <p className="muted small">{money(student.earned_cents)} course credit</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty">No successful student referrals yet.</p>
            )}
          </section>

          <section className="card">
            <h2>Successful referrals</h2>
            {data.successes.length ? (
              <div className="work-list">
                {data.successes.map((row) => (
                  <article className="work-item" key={row.id}>
                    <div className="work-head">
                      <strong>
                        {row.referrer_name} → {row.referee_name}
                      </strong>
                      <span className="muted small">{when(row.at)}</span>
                    </div>
                    <p className="muted small">
                      {row.code ? `${row.code} · ` : ""}
                      {row.referee_email}
                    </p>
                    <p>
                      {money(row.amount_cents)} · {row.rate_label}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty">No successful referrals recorded yet.</p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
