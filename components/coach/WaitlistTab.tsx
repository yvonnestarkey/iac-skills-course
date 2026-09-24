"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { exportWaitlistCsv, WAITLIST_EXAMS, WAITLIST_INSTITUTIONS, WAITLIST_PAYMENTS, type WaitlistLead } from "@/lib/waitlist";

type Filter = "all" | string;
type PaymentFilter = "all" | (typeof WAITLIST_PAYMENTS)[number];
type InstitutionFilter = "all" | (typeof WAITLIST_INSTITUTIONS)[number];
type StatusFilter = "all" | "waiting" | "invited" | "existing_account" | "granted";

type WaitlistInviteLead = WaitlistLead & {
  invitation_status?: string | null;
  account_exists?: boolean;
  entitlement_status?: string | null;
  entitlement_source?: string | null;
};

function waitlistReplyHref(lead: WaitlistLead): string {
  const first = lead.full_name.trim().split(/\s+/)[0] || "";
  const subject = lead.query ? "Your IAC Skills Course question" : "IAC Skills Course";
  const body = lead.query
    ? `Hi ${first},\n\nThanks for your question:\n\n${lead.query}\n\n`
    : `Hi ${first},\n\n`;
  return `mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function statusLabel(lead: WaitlistInviteLead): string {
  if (lead.invitation_status === "invited") return "Invited";
  if (lead.invitation_status === "granted") return "Existing account — access granted";
  if (lead.invitation_status === "existing_account" || lead.account_exists) return "Existing account";
  return "Waiting";
}

export default function WaitlistTab() {
  const router = useRouter();
  const [leads, setLeads] = useState<WaitlistInviteLead[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [institutionFilter, setInstitutionFilter] = useState<InstitutionFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [confirmSend, setConfirmSend] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    const response = await fetch("/api/coach/invites");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Could not load the waitlist.");
    return (payload.leads || []) as WaitlistInviteLead[];
  };

  useEffect(() => {
    let cancelled = false;
    load()
      .then((next) => {
        if (cancelled) return;
        setLeads(next);
        setError("");
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
        setLeads([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
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
        if (institutionFilter !== "all" && lead.institution !== institutionFilter) return false;
        if (statusFilter !== "all") {
          const status = lead.invitation_status || (lead.account_exists ? "existing_account" : "waiting");
          if (status !== statusFilter) return false;
        }
        return true;
      }),
    [filter, paymentFilter, institutionFilter, statusFilter, leads]
  );

  const selectedLeads = visible.filter((lead) => selected[lead.id]);

  const toggle = (id: string, checked: boolean) => {
    setSelected((current) => ({ ...current, [id]: checked }));
    setConfirmSend(false);
    setNotice("");
  };

  const sendSelected = async () => {
    if (!selectedLeads.length || !confirmSend) return;
    setSending(true);
    setError("");
    setNotice("");
    const response = await fetch("/api/coach/invites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "invite_waitlist",
        confirm: true,
        lead_ids: selectedLeads.map((lead) => lead.id),
      }),
    });
    const payload = await response.json();
    setSending(false);
    if (!response.ok) {
      setError(payload.error || "Could not send invitations.");
      return;
    }
    const lines = (payload.outcomes || []).map(
      (row: { email: string; message: string }) => `${row.email}: ${row.message}`
    );
    setNotice(lines.join(" ") || "Done.");
    setConfirmSend(false);
    setSelected({});
    try {
      setLeads(await load());
    } catch {
      /* keep current rows */
    }
  };

  return (
    <div className="coach-page">
      <button className="back-link" type="button" onClick={() => router.push("/coach")}>
        ← Coach home
      </button>
      <div className="coach-head">
        <div>
          <h1>Waitlist</h1>
          <p className="muted">
            Existing sales-page waitlist. Select people and send free-preview invitations. Nothing is emailed until you
            confirm Send selected invitations. Test with one email first.
          </p>
        </div>
        <div className="actions">
          <button className="ghost" type="button" onClick={() => router.push("/coach/students/new")}>
            Add Student
          </button>
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
        <button className="tab" type="button" onClick={() => router.push("/coach/students/new")}>
          Add Student
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
        <button type="button" className={institutionFilter === "all" ? "active" : ""} onClick={() => setInstitutionFilter("all")}>
          All institutions
        </button>
        {WAITLIST_INSTITUTIONS.map((body) => {
          const count = leads.filter((lead) => lead.institution === body).length;
          return (
            <button
              key={body}
              type="button"
              className={institutionFilter === body ? "active" : ""}
              onClick={() => setInstitutionFilter(body)}
            >
              {body} ({count})
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

      <div className="filters">
        {(
          [
            ["all", "All statuses"],
            ["waiting", "Waiting"],
            ["invited", "Invited"],
            ["existing_account", "Existing account"],
            ["granted", "Granted"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" className={statusFilter === id ? "active" : ""} onClick={() => setStatusFilter(id)}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <p className="empty">Loading waitlist…</p> : null}
      {error ? <div className="notice">{error}</div> : null}
      {notice ? <div className="notice">{notice}</div> : null}
      {!loading && !error && !visible.length ? <p className="empty">No waitlist leads in this filter yet.</p> : null}
      {visible.length ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invite</th>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Target exam</th>
                <th>Institution</th>
                <th>Preferred payment</th>
                <th>Query</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={Boolean(selected[lead.id])}
                      onChange={(event) => toggle(lead.id, event.target.checked)}
                      aria-label={`Select ${lead.full_name || lead.email}`}
                    />
                  </td>
                  <td>{lead.full_name}</td>
                  <td>
                    <a href={waitlistReplyHref(lead)}>{lead.email}</a>
                  </td>
                  <td>{statusLabel(lead)}</td>
                  <td>{lead.preferred_cohort}</td>
                  <td>{lead.institution || "—"}</td>
                  <td>{lead.preferred_payment || "—"}</td>
                  <td className="waitlist-query-cell">{lead.query || "—"}</td>
                  <td>{new Date(lead.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {selectedLeads.length ? (
        <section className="card waitlist-invite-confirm">
          <h2>People about to receive a free-preview invitation</h2>
          <p className="muted">
            Only the people listed here will be emailed. Existing accounts are not duplicated and their passwords are not
            changed. Start with one test email.
          </p>
          <ul className="waitlist-invite-list">
            {selectedLeads.map((lead) => (
              <li key={lead.id}>
                <strong>{lead.full_name || lead.email}</strong> — {lead.email}
                {lead.account_exists ? " (account already exists)" : ""}
              </li>
            ))}
          </ul>
          <label className="student-notes-label">
            <input type="checkbox" checked={confirmSend} onChange={(event) => setConfirmSend(event.target.checked)} /> I
            confirm I want to send invitations to the people listed above.
          </label>
          <div className="actions">
            <button className="primary" type="button" onClick={sendSelected} disabled={!confirmSend || sending}>
              {sending ? "Sending…" : selectedLeads.length === 1 ? "Send invitation" : "Send selected invitations"}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
