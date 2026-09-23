"use client";

import { useEffect, useState } from "react";

type CommercePayload = {
  profiles: { id: string; email: string; full_name: string | null; role: string }[];
  entitlements: { user_id: string; status: string; source: string; updated_at: string }[];
  purchases: {
    id: string;
    user_id: string;
    option: string;
    status: string;
    referral_code_used: string | null;
    amount_cents: number;
    updated_at: string;
  }[];
  rewards: { id: string; referrer_user_id: string; amount_cents: number; status: string; updated_at: string }[];
  refund_due: { id: string; referrer_user_id: string; amount_cents: number }[];
};

export default function CoachCommercePage() {
  const [data, setData] = useState<CommercePayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/coach/commerce")
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not load commerce data.");
        setData(payload);
      })
      .catch((item) => setError(item instanceof Error ? item.message : "Could not load commerce data."));
  }, []);

  const grant = async (userId: string) => {
    await fetch("/api/coach/commerce", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    window.location.reload();
  };

  const emailFor = (id: string) => data?.profiles.find((row) => row.id === id)?.email || id;

  return (
    <div className="coach-page">
      <section className="card">
        <h1 className="brand">Payments & referrals</h1>
        <p className="muted">Launch operations view. Granting full access is an admin action, not a student self-serve control.</p>
        {error ? <p className="student-auth-error">{error}</p> : null}
        {!data ? <p>Loading…</p> : null}
        {data ? (
          <>
            <h2>Accounts</h2>
            <ul>
              {data.entitlements.map((row) => (
                <li key={row.user_id}>
                  {emailFor(row.user_id)} — {row.status} ({row.source})
                  {row.status !== "full" ? (
                    <button className="ghost" type="button" onClick={() => void grant(row.user_id)}>
                      Grant full access
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            <h2>Purchases</h2>
            <ul>
              {data.purchases.map((row) => (
                <li key={row.id}>
                  {emailFor(row.user_id)} — {row.option} — {row.status}
                  {row.referral_code_used ? ` — referral ${row.referral_code_used}` : ""}
                </li>
              ))}
            </ul>
            <h2>Credits / refunds to action</h2>
            <ul>
              {data.refund_due.length ? (
                data.refund_due.map((row) => (
                  <li key={row.id}>
                    {emailFor(row.referrer_user_id)} — US${(row.amount_cents / 100).toFixed(0)} refund/credit due
                  </li>
                ))
              ) : (
                <li>None</li>
              )}
            </ul>
          </>
        ) : null}
      </section>
    </div>
  );
}
