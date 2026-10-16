"use client";

export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} style={{ padding: "8px 14px", fontSize: 14, cursor: "pointer" }}>
      Save as PDF / Print
    </button>
  );
}
