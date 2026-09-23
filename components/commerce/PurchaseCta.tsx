"use client";

import Link from "next/link";

export default function PurchaseCta({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <Link className="primary" href="/checkout">
        Buy full course
      </Link>
    );
  }
  return (
    <section className="card">
      <p className="kicker">Full Jan 2027 access</p>
      <h2>Unlock the complete IAC Skills Course</h2>
      <p className="muted">Preview lessons stay free. Paid lessons open after a successful Stripe payment on this same account.</p>
      <div className="actions">
        <Link className="primary" href="/checkout">
          Buy full course
        </Link>
      </div>
    </section>
  );
}
