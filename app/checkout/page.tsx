"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { FALLBACK_PRODUCT } from "@/lib/commerce";

export default function CheckoutPage() {
  const [option, setOption] = useState<"once_off" | "plan_6">("once_off");
  const [referral, setReferral] = useState("");
  const [promo, setPromo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ option, referral_code: referral, promo_code: promo }),
    });
    const payload = await response.json();
    setBusy(false);
    if (!response.ok || !payload.url) {
      setError(payload.error || "Could not start checkout.");
      return;
    }
    window.location.href = payload.url;
  };

  return (
    <section className="card login">
      <p className="kicker">Buy Jan 2027 IAC Course</p>
      <h1 className="brand">Choose how you pay</h1>
      <p className="muted">Charged in USD. ZAR amounts are approximate only.</p>
      {option === "plan_6" ? (
        <p className="muted small">
          {referral.trim()
            ? "With a referral code, the first instalment of US$57 is charged when you enrol. The remaining five US$57 instalments are charged at the end of each following month."
            : "The first instalment is charged when you enrol. The remaining five are charged at the end of each following month."}
        </p>
      ) : null}
      <form onSubmit={submit}>
        <label className="student-notes-label">
          <input type="radio" name="option" checked={option === "once_off"} onChange={() => setOption("once_off")} />
          {referral.trim()
            ? "Pay once: US$310.65 with referral (5% off US$327)"
            : `Pay once: US$327 (${FALLBACK_PRODUCT.zar_once_off_caption})`}
        </label>
        <label className="student-notes-label">
          <input type="radio" name="option" checked={option === "plan_6"} onChange={() => setOption("plan_6")} />
          {referral.trim()
            ? "6 monthly instalments of US$57 (US$342 total)"
            : `6 monthly instalments of US$60 (${FALLBACK_PRODUCT.zar_plan_caption})`}
        </label>
        <label className="student-notes-label" htmlFor="referral">
          Referral code
        </label>
        <input id="referral" value={referral} onChange={(event) => setReferral(event.target.value)} placeholder="JAN27-XXXXXXXX" />
        <label className="student-notes-label" htmlFor="promo">
          Promotional code
        </label>
        <input id="promo" value={promo} onChange={(event) => setPromo(event.target.value)} />
        <p className="muted small">Referral and promotional codes cannot be combined.</p>
        {error ? (
          <p className="student-auth-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="primary" type="submit" disabled={busy}>
          Continue to credit card payment
        </button>
      </form>
    </section>
  );
}
