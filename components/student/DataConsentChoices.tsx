"use client";

import { CONSENT_TEXT, RESEARCH_REVIEW_LABEL, type ConsentChoice, type ConsentKey } from "@/lib/data-consent";

/**
 * Two opt-in tickboxes, each with its detail collapsed under "Read here to see what this means".
 * Research has a third option: ticked plus "as long as I can see my data before you publish it".
 */
export default function DataConsentChoices({
  value,
  onChange,
  disabled,
}: {
  value: ConsentChoice;
  onChange: (next: ConsentChoice) => void;
  disabled?: boolean;
}) {
  return (
    <div className="consent-choices">
      {(Object.keys(CONSENT_TEXT) as ConsentKey[]).map((key) => {
        const text = CONSENT_TEXT[key];
        return (
          <div key={key} className="consent-choice">
            <label className="consent-tick">
              <input
                type="checkbox"
                checked={value[key]}
                disabled={disabled}
                onChange={(event) =>
                  onChange({ ...value, [key]: event.target.checked, ...(key === "research" && !event.target.checked ? { researchReview: false } : {}) })
                }
              />
              <span>{text.label}</span>
            </label>
            {key === "research" && value.research ? (
              <label className="consent-tick consent-sub">
                <input
                  type="checkbox"
                  checked={value.researchReview}
                  disabled={disabled}
                  onChange={(event) => onChange({ ...value, researchReview: event.target.checked })}
                />
                <span>{RESEARCH_REVIEW_LABEL}</span>
              </label>
            ) : null}
            <details className="consent-more">
              <summary>{text.more}</summary>
              {text.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </details>
          </div>
        );
      })}
    </div>
  );
}
