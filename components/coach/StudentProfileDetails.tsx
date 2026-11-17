"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import HelpTooltip from "@/components/ui/HelpTooltip";
import {
  COACH_PROFILE_COUNTRIES,
  COACH_PROFILE_CTA_ATTEMPTS,
  COACH_PROFILE_IAC_ATTEMPTS,
  COACH_PROFILE_INSTITUTIONS,
  COACH_PROFILE_YEARS,
  coachStudentProfileForm,
  coachStudentProfileSummary,
  validateCoachStudentProfile,
  withCurrentOption,
  type CoachStudentProfileForm,
  type CoachStudentProfilePatch,
} from "@/lib/coach-student-profile";
import type { Student } from "@/lib/types";

function Field({
  id,
  label,
  hint,
  children,
}: {
  id?: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="onboarding-field">
      <div className="onboarding-field-label">
        <label className="student-notes-label" htmlFor={id}>
          {label}
        </label>
        {hint ? <HelpTooltip contentKey={hint} /> : null}
      </div>
      {children}
    </div>
  );
}

export default function StudentProfileDetails({
  student,
  onSaved,
}: {
  student: Student;
  onSaved: (patch: CoachStudentProfilePatch) => void;
}) {
  const seed = useMemo(() => coachStudentProfileForm(student), [student]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CoachStudentProfileForm>(seed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setForm(seed);
    setError("");
    setNotice("");
  }, [seed, student.id]);

  const setField = <K extends keyof CoachStudentProfileForm>(key: K, value: CoachStudentProfileForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
    setNotice("");
  };

  const save = async () => {
    const invalid = validateCoachStudentProfile(form);
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
          email: student.email,
          onboarding_completed: student.onboardingCompleted === true,
          onboarding_skipped: student.onboardingSkipped === true,
          first_name: form.firstName,
          last_name: form.lastName,
          phone: form.phone,
          accountability_email: form.accountabilityEmail,
          written_exam: form.writtenExam,
          iac_attempts: form.iacAttempts,
          country: form.country,
          institution: form.institution,
          institution_other: form.institutionOther,
          year_passed: form.yearPassed,
          cta_attempts: form.ctaAttempts,
          struggle_areas: form.struggleAreas,
          coaching_goals: form.coachingGoals,
          additional_notes: form.additionalNotes,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        patch?: CoachStudentProfilePatch;
      };
      if (!response.ok || !payload.patch) {
        setError(payload.error || "Could not save this profile.");
        return;
      }
      onSaved(payload.patch);
      setNotice("Profile saved. Blank fields are fine — add the rest when you have it.");
    } catch {
      setError("Could not save this profile.");
    } finally {
      setBusy(false);
    }
  };

  const countries = withCurrentOption(COACH_PROFILE_COUNTRIES, form.country);
  const institutions = withCurrentOption(COACH_PROFILE_INSTITUTIONS, form.institution === "Other" ? "" : form.institution);
  const years = withCurrentOption(COACH_PROFILE_YEARS, form.yearPassed);
  const iacAttempts = withCurrentOption(COACH_PROFILE_IAC_ATTEMPTS, form.iacAttempts);
  const ctaAttempts = withCurrentOption(COACH_PROFILE_CTA_ATTEMPTS, form.ctaAttempts);

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
            <p className="muted small">{open ? "Edit any of this — first name only is fine." : coachStudentProfileSummary(student, form)}</p>
          </div>
          <span className="activity-progress-meta">
            {open ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
          </span>
        </button>
      </div>
      {open ? (
        <>
          <p className="muted small">
            Save whatever they emailed you. If they skipped onboarding, add the background here and it counts as
            completed.
          </p>
          <div className="profile-name-row">
            <Field id="coach-student-first-name" label="First name">
              <input
                id="coach-student-first-name"
                type="text"
                autoComplete="given-name"
                value={form.firstName}
                onChange={(event) => setField("firstName", event.target.value)}
              />
            </Field>
            <Field id="coach-student-last-name" label="Surname">
              <input
                id="coach-student-last-name"
                type="text"
                autoComplete="family-name"
                value={form.lastName}
                onChange={(event) => setField("lastName", event.target.value)}
              />
            </Field>
          </div>
          <div className="profile-name-row">
            <Field id="coach-student-phone" label="Phone" hint="phone_number_info">
              <input
                id="coach-student-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+27 82 123 4567"
                value={form.phone}
                onChange={(event) => setField("phone", event.target.value)}
              />
            </Field>
            <Field id="coach-student-accountability" label="Accountability email" hint="accountability_email_info">
              <input
                id="coach-student-accountability"
                type="email"
                autoComplete="email"
                placeholder="someone-who-will-nudge-them@example.com"
                value={form.accountabilityEmail}
                onChange={(event) => setField("accountabilityEmail", event.target.value)}
              />
            </Field>
          </div>

          <h3 className="student-profile-onboarding-heading">Onboarding</h3>
          <p className="student-notes-label" id="coach-written-label">
            Written the IAC exam before
          </p>
          <div className="onboarding-choice" role="group" aria-labelledby="coach-written-label">
            <button
              className={form.writtenExam === "yes" ? "primary" : "ghost"}
              type="button"
              onClick={() => setField("writtenExam", "yes")}
            >
              Yes
            </button>
            <button
              className={form.writtenExam === "no" ? "primary" : "ghost"}
              type="button"
              onClick={() => setField("writtenExam", "no")}
            >
              No
            </button>
            <button
              className={form.writtenExam === "" ? "primary" : "ghost"}
              type="button"
              onClick={() => setField("writtenExam", "")}
            >
              Not sure
            </button>
          </div>
          {form.writtenExam === "yes" ? (
            <Field id="coach-student-iac-attempts" label="IAC attempts">
              <select
                className="select-line"
                id="coach-student-iac-attempts"
                value={form.iacAttempts}
                onChange={(event) => setField("iacAttempts", event.target.value)}
              >
                <option value="">Not sure</option>
                {iacAttempts.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <div className="profile-name-row">
            <Field id="coach-student-country" label="Country">
              <select
                className="select-line"
                id="coach-student-country"
                value={form.country}
                onChange={(event) => setField("country", event.target.value)}
              >
                <option value="">Not sure</option>
                {countries.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="coach-student-institution" label="CTA / PGDA institution">
              <select
                className="select-line"
                id="coach-student-institution"
                value={form.institution}
                onChange={(event) => setField("institution", event.target.value)}
              >
                <option value="">Not sure</option>
                {institutions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {form.institution === "Other" ? (
            <Field id="coach-student-institution-other" label="Institution name">
              <input
                id="coach-student-institution-other"
                type="text"
                value={form.institutionOther}
                onChange={(event) => setField("institutionOther", event.target.value)}
              />
            </Field>
          ) : null}
          <div className="profile-name-row">
            <Field id="coach-student-year" label="Year CTA / PGDA passed">
              <select
                className="select-line"
                id="coach-student-year"
                value={form.yearPassed}
                onChange={(event) => setField("yearPassed", event.target.value)}
              >
                <option value="">Not sure</option>
                {years.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="coach-student-cta-attempts" label="CTA / PGDA attempts">
              <select
                className="select-line"
                id="coach-student-cta-attempts"
                value={form.ctaAttempts}
                onChange={(event) => setField("ctaAttempts", event.target.value)}
              >
                <option value="">Not sure</option>
                {ctaAttempts.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field id="coach-student-struggle" label="Where they struggle">
            <textarea
              id="coach-student-struggle"
              rows={3}
              value={form.struggleAreas}
              onChange={(event) => setField("struggleAreas", event.target.value)}
            />
          </Field>
          <Field id="coach-student-goals" label="What they want from coaching">
            <textarea
              id="coach-student-goals"
              rows={3}
              value={form.coachingGoals}
              onChange={(event) => setField("coachingGoals", event.target.value)}
            />
          </Field>
          <Field id="coach-student-notes" label="Additional notes">
            <textarea
              id="coach-student-notes"
              rows={3}
              value={form.additionalNotes}
              onChange={(event) => setField("additionalNotes", event.target.value)}
            />
          </Field>
          <p className="coaching-actions">
            <button className="primary" type="button" disabled={busy} onClick={() => void save()}>
              {busy ? "Saving…" : "Save profile"}
            </button>
          </p>
          {error ? <p className="notice">{error}</p> : null}
          {notice ? <p className="muted small">{notice}</p> : null}
        </>
      ) : null}
    </section>
  );
}
