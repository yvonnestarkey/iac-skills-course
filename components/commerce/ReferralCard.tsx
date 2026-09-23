"use client";

import { useEffect, useState } from "react";

type ReferralPayload = {
  code: string;
  blurb: string;
  successful_referrals: number;
  earned_cents: number;
  toward_free_cents: number;
  once_off_cents: number;
  referee_percent?: number;
  referrer_percent?: number;
};

function money(cents: number) {
  return `US$${(cents / 100).toFixed(0)}`;
}

export default function ReferralCard() {
  const [data, setData] = useState<ReferralPayload | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/referrals")
      .then((response) => response.json())
      .then((payload) => {
        if (payload?.code) setData(payload);
      })
      .catch(() => undefined);
  }, []);

  if (!data) return null;

  return (
    <section className="card">
      <p className="kicker">Refer a colleague</p>
      <h2>Your referral code</h2>
      <p className="muted">{data.blurb}</p>
      <p>
        <strong>{data.code}</strong>
      </p>
      <div className="actions">
        <button
          className="ghost"
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(data.code);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy code"}
        </button>
      </div>
      <p className="muted small">
        {data.successful_referrals} successful referrals · {money(data.earned_cents)} credit earned · {money(data.toward_free_cents)} of {money(data.once_off_cents)} toward a free course
      </p>
    </section>
  );
}
