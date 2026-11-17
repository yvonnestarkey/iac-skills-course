"use client";

import { useRouter } from "next/navigation";
import LiveAttemptsPanel from "@/components/coach/LiveAttemptsPanel";

export default function LiveSessionAttemptsPage() {
  const router = useRouter();
  return (
    <div className="coach-page">
      <button className="back-link" type="button" onClick={() => router.push("/coach/tools")}>
        ← Tools
      </button>
      <p className="kicker">Tools</p>
      <h1>Live-session attempts</h1>
      <p className="muted small" style={{ marginBottom: 16 }}>
        Attempts made on the open live links, saved under the email each student typed. Where the email matches a course account, the name links to that student&apos;s profile.
      </p>
      <section className="card">
        <LiveAttemptsPanel />
      </section>
    </div>
  );
}
