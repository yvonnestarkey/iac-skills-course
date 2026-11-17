"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import OnboardingFacts from "@/components/account/OnboardingFacts";
import {
  editablePersonName,
  joinPersonName,
  validatePersonName,
} from "@/lib/account-profile";
import { onboardingSurveyAnswers } from "@/lib/roster";
import type { Student } from "@/lib/types";

export default function StudentProfileDetails({
  student,
  onNameSaved,
}: {
  student: Student;
  onNameSaved: (name: string) => void;
}) {
  const seed = useMemo(
    () => editablePersonName(student.name, student.email),
    [student.name, student.email]
  );
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState(seed.firstName);
  const [lastName, setLastName] = useState(seed.lastName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setFirstName(seed.firstName);
    setLastName(seed.lastName);
    setError("");
    setNotice("");
  }, [seed.firstName, seed.lastName, student.id]);

  const answers = onboardingSurveyAnswers(student);
  const savedName = joinPersonName(seed.firstName, seed.lastName);
  const summary = savedName || "Name not set";

  const save = async () => {
    const invalid = validatePersonName(firstName, lastName);
    if (invalid) {
      setError(invalid);
      setNotice("");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/coach/student-profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          student_id: student.id,
          first_name: firstName,
          last_name: lastName,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; name?: string };
      if (!response.ok) {
        setError(payload.error || "Could not save the name.");
        return;
      }
      const name = payload.name || joinPersonName(firstName, lastName);
      onNameSaved(name);
      setNotice("Name saved.");
    } catch {
      setError("Could not save the name.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card" id="student-profile-details">
      <div className="panel-head">
        <button
          type="button"
          className="activity-progress-toggle"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          <div>
            <h2>Profile</h2>
            {open ? (
              <p className="muted small">Name, surname, and the answers they gave at onboarding.</p>
            ) : (
              <p className="muted small">{summary}</p>
            )}
          </div>
          <span className="activity-progress-meta">
            {open ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
          </span>
        </button>
      </div>
      {open ? (
        <>
          <div className="profile-name-row">
            <div className="onboarding-field">
              <label className="student-notes-label" htmlFor="coach-student-first-name">
                First name
              </label>
              <input
                id="coach-student-first-name"
                type="text"
                autoComplete="given-name"
                value={firstName}
                onChange={(event) => {
                  setFirstName(event.target.value);
                  setError("");
                  setNotice("");
                }}
              />
            </div>
            <div className="onboarding-field">
              <label className="student-notes-label" htmlFor="coach-student-last-name">
                Surname
              </label>
              <input
                id="coach-student-last-name"
                type="text"
                autoComplete="family-name"
                value={lastName}
                onChange={(event) => {
                  setLastName(event.target.value);
                  setError("");
                  setNotice("");
                }}
              />
            </div>
          </div>
          <p className="coaching-actions">
            <button className="primary" type="button" disabled={busy} onClick={() => void save()}>
              {busy ? "Saving…" : "Save name"}
            </button>
          </p>
          {error ? <p className="notice">{error}</p> : null}
          {notice ? <p className="muted small">{notice}</p> : null}
          <h3 className="student-profile-onboarding-heading">Onboarding</h3>
          <OnboardingFacts answers={answers} />
        </>
      ) : null}
    </section>
  );
}
