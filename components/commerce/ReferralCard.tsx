"use client";

import { useEffect, useState } from "react";
import HelpTooltip from "@/components/ui/HelpTooltip";
import { unpaidPreviewReferralNote } from "@/lib/account-access";
import { formatUsdCents } from "@/lib/format-money";
import { useStudentSession } from "@/lib/student-session";

type ReferralPayload = {
  code: string;
  blurb: string;
  successful_referrals: number;
  pending_referrals?: number;
  earned_cents: number;
  toward_free_cents: number;
  once_off_cents: number;
  referee_percent?: number;
  referrer_percent?: number;
};

function money(cents: number) {
  return formatUsdCents(cents);
}

export default function ReferralCard() {
  const { entitlement } = useStudentSession();
  const [data, setData] = useState<ReferralPayload | null>(null);
  const [copied, setCopied] = useState(false);
  const storedNote = unpaidPreviewReferralNote(entitlement);
  const pending = data?.pending_referrals || 0;

  useEffect(() => {
    fetch("/api/referrals")
      .then((response) => response.json())
      .then((payload) => {
        if (payload?.code) setData(payload);
      })
      .catch(() => undefined);
  }, []);

  return (
    <section className="card">
      <p className="kicker">
        Referral programme
        <HelpTooltip contentKey="referral_programme_info" />
      </p>
      <h2>Your referral code</h2>
      <p className="muted">{data?.blurb || "Your friend receives 5% off. You earn 10% course credit after their qualifying payment."}</p>
      {storedNote ? <p className="muted">{storedNote}</p> : null}
      {data?.code ? (
        <>
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
        </>
      ) : (
        <p className="muted small">Loading your code…</p>
      )}
      <p className="muted small">
        {pending ? `${pending} stored on this account · ` : null}
        {data?.successful_referrals || 0} successful referrals · {money(data?.earned_cents || 0)} credit earned
        {storedNote && (data?.earned_cents || 0) > 0 ? " · applies when you register" : ""}
      </p>
    </section>
  );
}
