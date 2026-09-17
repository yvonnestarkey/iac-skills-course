"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { exportWaitlistCsv, fetchWaitlistLeads, WAITLIST_EXAMS, WAITLIST_PAYMENTS, type WaitlistLead } from "@/lib/waitlist";

type Filter = "all" | string;
type PaymentFilter = "all" | (typeof WAITLIST_PAYMENTS)[number];

export default function WaitlistTab() {
  const router = useRouter();
  const [leads, setLeads] = useState<WaitlistLead[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchWaitlistLeads().then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.ok === false) {
        setError(result.error);
        setLeads([]);
        return;
      }
      setError("");
      setLeads(result.leads);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const examOptions = useMemo(() => {
    const values = new Set<string>(WAITLIST_EXAMS);
    leads.forEach((lead) => {
      if (lead.preferred_cohort) values.add(lead.preferred_cohort);
    });
    return [...values];
  }, [leads]);

  const visible = useMemo(
    () =>
      leads.filter((lead) => {
        if (filter !== "all" && lead.preferred_cohort !== filter) return false;
        if (paymentFilter !== "all" && lead.preferred_payment !== paymentFilter) return false;
        return true;
      }),
    [filter, paymentFilter, leads]
  );

  return (
    <div className="coach-page">
      <button className="back-link" type="button" onClick={() => router.push("/coach")}>
        ← Coach home
      </button>
      <div className="coach-head">
        <div>
          <h1>Waitlist</h1>
          <p className="muted">Leads from the public sales page. Filter by target exam or payment plan and export the email list.</p>
        </div>
        <div className="actions">
          <button className="primary" type="button" onClick={() => exportWaitlistCsv(visible)} disabled={!visible.length}>
            Export CSV
          </button>
        </div>
      </div>

      <div className="tabs">
        <button className="tab" type="button" onClick={() => router.push("/coach/lists")}>
          Submissions
        </button>
        <button className="tab" type="button" onClick={() => router.push("/coach/lists")}>
          Surveys
        </button>
        <button className="tab" type="button" onClick={() => router.push("/coach/lists")}>
          Student Roster
        </button>
        <button className="tab" type="button" onClick={() => router.push("/coach/lists")}>
          BMCR Analytics
        </button>
        <button className="tab active" type="button">
          Waitlist
        </button>
        <button className="tab" type="button" onClick={() => router.push("/coach/inbox")}>
          Inbox
        </button>
      </div>

      <div className="filters">
        <button type="button" className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
          All ({leads.length})
        </button>
        {examOptions.map((exam) => {
          const count = leads.filter((lead) => lead.preferred_cohort === exam).length;
          return (
            <button
              key={exam}
              type="button"
              className={filter === exam ? "active" : ""}
              onClick={() => setFilter(exam)}
            >
              {exam} ({count})
            </button>
          );
        })}
      </div>

      <div className="filters">
        <button type="button" className={paymentFilter === "all" ? "active" : ""} onClick={() => setPaymentFilter("all")}>
          All plans
        </button>
        {WAITLIST_PAYMENTS.map((plan) => {
          const count = leads.filter((lead) => lead.preferred_payment === plan).length;
          return (
            <button
              key={plan}
              type="button"
              className={paymentFilter === plan ? "active" : ""}
              onClick={() => setPaymentFilter(plan)}
            >
              {plan} ({count})
            </button>
          );
        })}
      </div>

      {loading ? <p className="empty">Loading waitlist…</p> : null}
      {error ? <div className="notice">{error}</div> : null}
      {!loading && !error && !visible.length ? <p className="empty">No waitlist leads in this filter yet.</p> : null}
      {visible.length ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Target exam</th>
                <th>Preferred payment</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((lead) => (
                <tr key={lead.id}>
                  <td>{lead.full_name}</td>
                  <td>
                    <a href={`mailto:${lead.email}`}>{lead.email}</a>
                  </td>
                  <td>{lead.preferred_cohort}</td>
                  <td>{lead.preferred_payment || "—"}</td>
                  <td>{new Date(lead.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
