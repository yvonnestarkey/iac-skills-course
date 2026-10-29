"use client";

import { CONSENT_TEXT, type ConsentKey } from "@/lib/data-consent";

/** Two opt-in tickboxes, each with its detail collapsed under "Read here to see what this means". */
export default function DataConsentChoices({
  value,
  onChange,
  disabled,
}: {
  value: Record<ConsentKey, boolean>;
  onChange: (next: Record<ConsentKey, boolean>) => void;
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
                onChange={(event) => onChange({ ...value, [key]: event.target.checked })}
              />
              <span>{text.label}</span>
            </label>
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
