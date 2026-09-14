"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import BrandMark from "@/components/BrandMark";
import {
  ONBOARDING_COUNTRIES,
  ONBOARDING_CTA_YEARS,
  ONBOARDING_INSTITUTIONS,
  ONBOARDING_PHONE_CODES,
  fetchOnboardingState,
  formatPhone,
  saveOnboarding,
  type OnboardingCountry,
} from "@/lib/onboarding";
import { isCoachAccount } from "@/lib/roles";
import { useStudentSession } from "@/lib/student-session";

const STEPS = ["Contact", "IAC exam", "Coaching", "CTA / PGDA"] as const;

export default function OnboardingForm() {
  const router = useRouter();
  const { ready, user, signOut } = useStudentSession();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [phoneCode, setPhoneCode] = useState<string>(ONBOARDING_PHONE_CODES[0].code);
  const [phoneNational, setPhoneNational] = useState("");
  const [accountabilityEmail, setAccountabilityEmail] = useState("");

  const [writtenExam, setWrittenExam] = useState<"yes" | "no" | "">("");
  const [iacAttempts, setIacAttempts] = useState("1");
  const [country, setCountry] = useState<OnboardingCountry>("South Africa");

  const [strugglingAreas, setStrugglingAreas] = useState("");
  const [coachingHopes, setCoachingHopes] = useState("");

  const [institution, setInstitution] = useState("");
  const [institutionOther, setInstitutionOther] = useState("");
  const [yearPassed, setYearPassed] = useState("2025");
  const [ctaAttempts, setCtaAttempts] = useState("1");
  const [additionalNotes, setAdditionalNotes] = useState("");

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/student/login");
      return;
    }
    if (isCoachAccount(user)) {
      router.replace("/student");
      return;
    }
    fetchOnboardingState(user.id).then((state) => {
      if (state.available && state.completed) router.replace("/student/overview");
    });
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

  const validateStep = (): string => {
    if (step === 0) {
      if (phoneNational.replace(/\D/g, "").length < 6) return "Enter your phone number, including the local digits.";
      if (!accountabilityEmail.trim() || !accountabilityEmail.includes("@")) {
        return "Enter an accountability email — someone who will keep you honest.";
      }
    }
    if (step === 1) {
      if (!writtenExam) return "Say whether you have written the IAC exam before.";
    }
    if (step === 2) {
      if (!strugglingAreas.trim()) return "Tell us where you are struggling.";
      if (!coachingHopes.trim()) return "Tell us what you hope to get from coaching.";
    }
    if (step === 3) {
      if (!institution) return "Select the institution where you passed CTA / PGDA.";
      if (institution === "Other" && !institutionOther.trim()) return "Type the institution name.";
    }
    return "";
  };

  const goNext = () => {
    const message = validateStep();
    if (message) {
      setError(message);
      return;
    }
    setError("");
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const message = validateStep();
    if (message) {
      setError(message);
      return;
    }
    setBusy(true);
    setError("");
    const result = await saveOnboarding(user.id, {
      phone: formatPhone(phoneCode, phoneNational),
      accountability_email: accountabilityEmail.trim(),
      demographics: {
        iac_written_exam_before: writtenExam === "yes",
        iac_attempt_count: writtenExam === "yes" ? Number(iacAttempts) : 0,
        country,
        cta_institution: institution === "Other" ? institutionOther.trim() : institution,
        cta_year_passed: Number(yearPassed),
        cta_attempts: Number(ctaAttempts),
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
    router.replace("/student/overview");
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

        <form onSubmit={submit}>
          {step === 0 ? (
            <fieldset className="onboarding-step">
              <legend>Contact</legend>
              <label className="student-notes-label" htmlFor="onboarding-phone">
                Phone number
              </label>
              <div className="onboarding-phone">
                <select
                  className="select-line"
                  id="onboarding-phone-code"
                  aria-label="Country code"
                  value={phoneCode}
                  onChange={(event) => setPhoneCode(event.target.value)}
                >
                  {ONBOARDING_PHONE_CODES.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <input
                  id="onboarding-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="82 123 4567"
                  value={phoneNational}
                  onChange={(event) => setPhoneNational(event.target.value)}
                  required
                />
              </div>
              <label className="student-notes-label" htmlFor="onboarding-accountability">
                Accountability email
              </label>
              <input
                id="onboarding-accountability"
                type="email"
                autoComplete="email"
                placeholder="someone-who-will-nudge-you@example.com"
                value={accountabilityEmail}
                onChange={(event) => setAccountabilityEmail(event.target.value)}
                required
              />
              <p className="muted small">We save this on your profile so we can reach you and your accountability partner.</p>
            </fieldset>
          ) : null}

          {step === 1 ? (
            <fieldset className="onboarding-step">
              <legend>IAC information</legend>
              <p className="student-notes-label" id="onboarding-written-label">
                Have you written the IAC exam before?
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
                    How many attempts?
                  </label>
                  <select
                    className="select-line"
                    id="onboarding-iac-attempts"
                    value={iacAttempts}
                    onChange={(event) => setIacAttempts(event.target.value)}
                  >
                    {[1, 2, 3, 4, 5, 6].map((count) => (
                      <option key={count} value={count}>
                        {count}
                      </option>
                    ))}
                  </select>
                </>
              ) : null}
              <label className="student-notes-label" htmlFor="onboarding-country">
                Country
              </label>
              <select
                className="select-line"
                id="onboarding-country"
                value={country}
                onChange={(event) => setCountry(event.target.value as OnboardingCountry)}
              >
                {ONBOARDING_COUNTRIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </fieldset>
          ) : null}

          {step === 2 ? (
            <fieldset className="onboarding-step">
              <legend>Where you are</legend>
              <label className="student-notes-label" htmlFor="onboarding-struggling">
                What are you struggling with?
              </label>
              <textarea
                id="onboarding-struggling"
                rows={4}
                placeholder="Theory, application, time, confidence…"
                value={strugglingAreas}
                onChange={(event) => setStrugglingAreas(event.target.value)}
                required
              />
              <label className="student-notes-label" htmlFor="onboarding-hopes">
                What do you hope coaching will do for you?
              </label>
              <textarea
                id="onboarding-hopes"
                rows={4}
                placeholder="A clearer plan, someone to check my work, a push when I stall…"
                value={coachingHopes}
                onChange={(event) => setCoachingHopes(event.target.value)}
                required
              />
            </fieldset>
          ) : null}

          {step === 3 ? (
            <fieldset className="onboarding-step">
              <legend>CTA / PGDA</legend>
              <label className="student-notes-label" htmlFor="onboarding-institution">
                Institution
              </label>
              <select
                className="select-line"
                id="onboarding-institution"
                value={institution}
                onChange={(event) => setInstitution(event.target.value)}
                required
              >
                <option value="">Select institution</option>
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
                  required
                />
              ) : null}
              <label className="student-notes-label" htmlFor="onboarding-year">
                Year passed
              </label>
              <select
                className="select-line"
                id="onboarding-year"
                value={yearPassed}
                onChange={(event) => setYearPassed(event.target.value)}
              >
                {ONBOARDING_CTA_YEARS.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <label className="student-notes-label" htmlFor="onboarding-cta-attempts">
                Attempts
              </label>
              <select
                className="select-line"
                id="onboarding-cta-attempts"
                value={ctaAttempts}
                onChange={(event) => setCtaAttempts(event.target.value)}
              >
                {[1, 2, 3, 4, 5].map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
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

          {error ? (
            <p className="student-auth-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="actions">
            {step > 0 ? (
              <button className="ghost" type="button" onClick={() => setStep((current) => current - 1)}>
                Back
              </button>
            ) : null}
            {step < STEPS.length - 1 ? (
              <button className="primary" type="button" onClick={goNext}>
                Continue
              </button>
            ) : (
              <button className="primary" type="submit" disabled={busy}>
                {busy ? "Saving…" : "Start the course"}
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
