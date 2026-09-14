"use client";

import { Download, FileText } from "lucide-react";

export default function LessonResources({ pdfUrl }: { pdfUrl?: string | null }) {
  const url = pdfUrl?.trim();
  if (!url) return null;

  return (
    <section className="lesson-resources" aria-labelledby="lesson-pdf-heading">
      <h2 id="lesson-pdf-heading">PDF resource</h2>
      <p className="muted">This file is for this lesson. It is not a submission.</p>
      <a className="primary lesson-resource-download" href={url} target="_blank" rel="noopener noreferrer">
        <Download size={16} />
        Download PDF Resource
      </a>
      <div className="lesson-pdf-frame">
        <iframe title="PDF resource" src={url} />
      </div>
      <p className="muted small lesson-pdf-fallback">
        <FileText size={12} /> If the preview is blank, use the download button.
      </p>
    </section>
  );
}
