"use client";

import { useState } from "react";
import { resetCoachReadingTask } from "@/lib/reading-drills-store";
import { isCoachAccount } from "@/lib/roles";
import { useStudentSession } from "@/lib/student-session";

/** Coach View only: wipe this task for the signed-in coach so they can test it again. */
export default function CoachReadingReset({
  kind,
  taskKey,
  onReset,
}: {
  kind: "exercise" | "check";
  taskKey: string;
  onReset: () => void;
}) {
  const { user } = useStudentSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!isCoachAccount(user) || !user?.id) return null;

  return (
    <div className="rd-coach-reset">
      <button
        type="button"
        className="rd-reset"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          const result = await resetCoachReadingTask({ studentId: user.id, kind, key: taskKey });
          setBusy(false);
          if (!result.ok) {
            setError(result.error || "Could not reset this reading task.");
            return;
          }
          onReset();
        }}
      >
        {busy ? "Resetting…" : "Reset"}
      </button>
      {error ? <p className="waiting">{error}</p> : null}
    </div>
  );
}
