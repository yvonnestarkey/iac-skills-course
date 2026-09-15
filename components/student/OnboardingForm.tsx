"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent, KeyboardEvent, MouseEvent, ReactNode } from "react";
import BrandMark from "@/components/BrandMark";
import HelpTooltip from "@/components/ui/HelpTooltip";
import {
  ONBOARDING_COUNTRIES,
  ONBOARDING_CTA_YEARS,
  ONBOARDING_INSTITUTIONS,
  saveOnboarding,
  markOnboardingSkipped,
  type OnboardingCountry,
} from "@/lib/onboarding";
import { isCoachAccount } from "@/lib/roles";
import { useStudentSession } from "@/lib/student-session";

const STEPS = ["IAC exam", "CTA / PGDA", "Notes", "Contact"] as const;
const LAST_STEP = STEPS.length - 1;

function FieldLabel({
  htmlFor,
  children,
  hint,
}: {
  htmlFor: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="onboarding-field-label">
      <label className="student-notes-label" htmlFor={htmlFor}>
        {children}
      </label>
      {hint}
    </div>
  );
}

export default function OnboardingForm({
  skipOnboarding,
}: {
  skipOnboarding: () => Promise<void>;
}) {
  const router = useRouter();
  const { ready, user, signOut } = useStudentSession();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [phone, setPhone] = useState("");
  const [accountabilityEmail, setAccountabilityEmail] = useState("");

  const [writtenExam, setWrittenExam] = useState<"yes" | "no" | "">("");
  const [iacAttempts, setIacAttempts] = useState("");
  const [country, setCountry] = useState<OnboardingCountry | "">("");

  const [strugglingAreas, setStrugglingAreas] = useState("");
  const [coachingHopes, setCoachingHopes] = useState("");

  const [institution, setInstitution] = useState("");
  const [institutionOther, setInstitutionOther] = useState("");
  const [yearPassed, setYearPassed] = useState("");
  const [ctaAttempts, setCtaAttempts] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/student/login");
      return;
    }
    if (isCoachAccount(user)) {
      router.replace("/student");
    }
  }, [ready, user, router]);

  if (!ready || !user) {
    return (
      <div className="student-player">
        <header className="student-player-bar">
          <BrandMark href="/onboarding" />
        </header>
        <p className="student-loading">Loading…</p>
      </div>
    );
  }

  const validateIac = (): string => {
    if (!writtenExam) return "Say whether you have written the IAC exam before.";
    if (writtenExam === "yes" && !iacAttempts) return "Select how many IAC attempts you have made.";
    return "";
  };

  const goNext = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (step >= LAST_STEP) return;
    const message = step === 0 ? validateIac() : "";
    if (message) {
      setError(message);
      return;
    }
    setError("");
    setStep((current) => Math.min(current + 1, LAST_STEP));
  };

  const goBack = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setError("");
    setStep((current) => Math.max(current - 1, 0));
  };

  const onFormKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== "Enter") return;
    const target = event.target as HTMLElement | null;
    if (target?.tagName === "TEXTAREA") return;
    event.preventDefault();
  };

  const onFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  const startCourse = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (step !== LAST_STEP) return;
    const message = validateIac();
    if (message) {
      setError(message);
      setStep(0);
      return;
    }
    setBusy(true);
    setError("");
    const result = await saveOnboarding(user.id, {
      phone: phone.trim() || null,
      accountability_email: accountabilityEmail.trim() || null,
      demographics: {
        iac_written_exam_before: writtenExam === "yes",
        iac_attempt_count: writtenExam === "yes" ? Number(iacAttempts) : null,
        country: country || null,
        cta_institution: (institution === "Other" ? institutionOther.trim() : institution) || null,
        cta_year_passed: yearPassed ? Number(yearPassed) : null,
        cta_attempts: ctaAttempts ? Number(ctaAttempts) : null,
      },
      qualitative_notes: {
        struggling_areas: strugglingAreas.trim(),
        coaching_hopes: coachingHopes.trim(),
        additional_notes: additionalNotes.trim(),
      },
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error || "Could not save your answers.");
      return;
    }
    router.refresh();
    router.replace("/student/overview");
  };

  const skipForNow = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setBusy(true);
    setError("");
    const skipped = await markOnboardingSkipped(user.id);
    if (!skipped.ok) {
      setBusy(false);
      setError(skipped.error || "Could not skip onboarding.");
      return;
    }
    await skipOnboarding();
  };

  return (
    <div className="student-player">
      <header className="student-player-bar">
        <BrandMark href="/onboarding" />
        <div className="topbar-right">
          {user.email ? <span className="muted small student-email">{user.email}</span> : null}
          <button
            className="ghost student-signout"
            type="button"
            onClick={async () => {
              await signOut();
              router.replace("/student/login");
            }}
          >
            Sign Out
          </button>
        </div>
      </header>

      <section className="card login onboarding-card">
        <p className="kicker">Welcome</p>
        <h1 className="brand">Before you start</h1>
        <p className="muted">A few questions so coaching can meet you where you are. This takes a couple of minutes.</p>

        <ol className="onboarding-progress" aria-label="Onboarding steps">
          {STEPS.map((label, index) => (
            <li key={label} className={index === step ? "on" : index < step ? "done" : ""}>
              <span>{index + 1}</span>
              {label}
            </li>
          ))}
        </ol>

        <form onSubmit={onFormSubmit} onKeyDown={onFormKeyDown} noValidate>
          {step === 0 ? (
            <fieldset className="onboarding-step">
              <legend>IAC exam</legend>
              <p className="student-notes-label" id="onboarding-written-label">
                Have you written the IAC exam before? <span className="muted">(required)</span>
              </p>
              <div className="onboarding-choice" role="group" aria-labelledby="onboarding-written-label">
                <button
                  className={writtenExam === "yes" ? "primary" : "ghost"}
                  type="button"
                  onClick={() => setWrittenExam("yes")}
                >
                  Yes
                </button>
                <button
                  className={writtenExam === "no" ? "primary" : "ghost"}
                  type="button"
                  onClick={() => setWrittenExam("no")}
                >
                  No
                </button>
              </div>
              {writtenExam === "yes" ? (
                <>
                  <label className="student-notes-label" htmlFor="onboarding-iac-attempts">
                    How many attempts? <span className="muted">(required)</span>
                  </label>
                  <select
                    className="select-line"
                    id="onboarding-iac-attempts"
                    value={iacAttempts}
                    onChange={(event) => setIacAttempts(event.target.value)}
                  >
                    <option value="">Select attempts</option>
                    {[1, 2, 3, 4, 5, 6].map((count) => (
                      <option key={count} value={count}>
                        {count}
                      </option>
                    ))}
                  </select>
                </>
              ) : null}
            </fieldset>
          ) : null}

          {step === 1 ? (
            <fieldset className="onboarding-step">
              <legend>Country &amp; CTA / PGDA</legend>
              <label className="student-notes-label" htmlFor="onboarding-country">
                Country <span className="muted">(optional)</span>
              </label>
              <select
                className="select-line"
                id="onboarding-country"
                value={country}
                onChange={(event) => setCountry(event.target.value as OnboardingCountry | "")}
              >
                <option value="">Prefer not to say</option>
                {ONBOARDING_COUNTRIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <label className="student-notes-label" htmlFor="onboarding-institution">
                Institution <span className="muted">(optional)</span>
              </label>
              <select
                className="select-line"
                id="onboarding-institution"
                value={institution}
                onChange={(event) => setInstitution(event.target.value)}
              >
                <option value="">Prefer not to say</option>
                {ONBOARDING_INSTITUTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              {institution === "Other" ? (
                <input
                  type="text"
                  aria-label="Institution name"
                  placeholder="Institution name"
                  value={institutionOther}
                  onChange={(event) => setInstitutionOther(event.target.value)}
                />
              ) : null}
              <label className="student-notes-label" htmlFor="onboarding-year">
                Year passed <span className="muted">(optional)</span>
              </label>
              <select
                className="select-line"
                id="onboarding-year"
                value={yearPassed}
                onChange={(event) => setYearPassed(event.target.value)}
              >
                <option value="">Prefer not to say</option>
                {ONBOARDING_CTA_YEARS.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <label className="student-notes-label" htmlFor="onboarding-cta-attempts">
                Attempts <span className="muted">(optional)</span>
              </label>
              <select
                className="select-line"
                id="onboarding-cta-attempts"
                value={ctaAttempts}
                onChange={(event) => setCtaAttempts(event.target.value)}
              >
                <option value="">Prefer not to say</option>
                {[1, 2, 3, 4, 5].map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
            </fieldset>
          ) : null}

          {step === 2 ? (
            <fieldset className="onboarding-step">
              <legend>Notes</legend>
              <label className="student-notes-label" htmlFor="onboarding-struggling">
                What are you struggling with? <span className="muted">(optional)</span>
              </label>
              <textarea
                id="onboarding-struggling"
                rows={4}
                placeholder="Theory, application, time, confidence…"
                value={strugglingAreas}
                onChange={(event) => setStrugglingAreas(event.target.value)}
              />
              <label className="student-notes-label" htmlFor="onboarding-hopes">
                What do you hope coaching will do for you? <span className="muted">(optional)</span>
              </label>
              <textarea
                id="onboarding-hopes"
                rows={4}
                placeholder="A clearer plan, someone to check my work, a push when I stall…"
                value={coachingHopes}
                onChange={(event) => setCoachingHopes(event.target.value)}
              />
              <label className="student-notes-label" htmlFor="onboarding-notes">
                Anything else we should know? <span className="muted">(optional)</span>
              </label>
              <textarea
                id="onboarding-notes"
                rows={4}
                placeholder="Work hours, exam date, access needs…"
                value={additionalNotes}
                onChange={(event) => setAdditionalNotes(event.target.value)}
              />
            </fieldset>
          ) : null}

          {step === 3 ? (
            <fieldset className="onboarding-step">
              <legend>Contact</legend>
              <div className="onboarding-field">
                <FieldLabel
                  htmlFor="onboarding-phone"
                  hint={<HelpTooltip contentKey="phone_number_info" />}
                >
                  Phone number (with country code) <span className="muted">(optional)</span>
                </FieldLabel>
                <input
                  id="onboarding-phone"
                  type="text"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+27 82 123 4567"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
              <div className="onboarding-field">
                <FieldLabel
                  htmlFor="onboarding-accountability"
                  hint={<HelpTooltip contentKey="accountability_email_info" />}
                >
                  Accountability email <span className="muted">(optional)</span>
                </FieldLabel>
                <input
                  id="onboarding-accountability"
                  type="email"
                  autoComplete="email"
                  placeholder="someone-who-will-nudge-you@example.com"
                  value={accountabilityEmail}
                  onChange={(event) => setAccountabilityEmail(event.target.value)}
                />
              </div>
              <p className="muted small">You can leave these blank.</p>
            </fieldset>
          ) : null}

          {error ? (
            <p className="student-auth-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="actions">
            {step > 0 ? (
              <button className="ghost" type="button" onClick={goBack}>
                Back
              </button>
            ) : null}
            {step < LAST_STEP ? (
              <button key="onboarding-next" className="primary" type="button" onClick={goNext}>
                Continue
              </button>
            ) : (
              <button key="onboarding-start" className="primary" type="button" disabled={busy} onClick={startCourse}>
                {busy ? "Saving…" : "Start the course"}
              </button>
            )}
            <button className="ghost" type="button" disabled={busy} onClick={skipForNow}>
              Skip for now (Complete on next login)
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
