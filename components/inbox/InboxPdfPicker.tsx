"use client";

import { Paperclip, X } from "lucide-react";

export default function InboxPdfPicker({
  file,
  onChange,
  disabled = false,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inbox-pdf-picker">
      <label className={`ghost inbox-pdf-pick${disabled ? " is-disabled" : ""}`}>
        <Paperclip size={16} />
        Attach PDF
        <input
          type="file"
          accept="application/pdf,.pdf"
          disabled={disabled}
          onChange={(event) => {
            const next = event.target.files && event.target.files[0];
            onChange(next || null);
            event.target.value = "";
          }}
        />
      </label>
      {file ? (
        <span className="inbox-pdf-chip">
          {file.name}
          <button type="button" className="link-btn" disabled={disabled} onClick={() => onChange(null)} aria-label="Remove PDF">
            <X size={14} />
          </button>
        </span>
      ) : null}
    </div>
  );
}
