"use client";

import { useEffect, useId, useState } from "react";
import { Download, Maximize2, X } from "lucide-react";
import { getLessonPdfUrl, type LessonPdfSource } from "@/lib/getLessonPdf";
import { asPdfUrl, pdfEmbedSrc } from "@/lib/lesson-resources";

export default function LessonPdfViewer({
  pdfUrl,
  lesson,
}: {
  pdfUrl?: string | null;
  lesson?: LessonPdfSource | null;
}) {
  const url = asPdfUrl(pdfUrl) || getLessonPdfUrl(lesson);
  const [fullScreen, setFullScreen] = useState(false);
  const titleId = useId();
  const modalTitleId = useId();

  useEffect(() => {
    if (!fullScreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullScreen(false);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [fullScreen]);

  if (!url) return null;

  const embedSrc = pdfEmbedSrc(url);

  return (
    <section className="lesson-pdf-viewer" aria-labelledby={titleId}>
      <div className="lesson-pdf-header">
        <div>
          <h2 id={titleId}>PDF resource</h2>
          <p className="muted">This file is for this lesson. It is not a submission.</p>
        </div>
        <div className="lesson-pdf-actions">
          <a className="primary lesson-pdf-download" href={url} target="_blank" rel="noopener noreferrer">
            <Download size={16} />
            Download PDF Resource
          </a>
          <button className="ghost" type="button" onClick={() => setFullScreen(true)}>
            <Maximize2 size={16} />
            Full Screen
          </button>
        </div>
      </div>
      <div className="lesson-pdf-frame">
        <iframe title="PDF resource" src={embedSrc} />
      </div>
      {fullScreen ? (
        <div className="lesson-pdf-modal" role="dialog" aria-modal="true" aria-labelledby={modalTitleId}>
          <div className="lesson-pdf-modal-bar">
            <h2 id={modalTitleId}>PDF resource</h2>
            <div className="lesson-pdf-actions">
              <a className="primary lesson-pdf-download" href={url} target="_blank" rel="noopener noreferrer">
                <Download size={16} />
                Download PDF Resource
              </a>
              <button className="ghost" type="button" onClick={() => setFullScreen(false)}>
                <X size={16} />
                Close
              </button>
            </div>
          </div>
          <div className="lesson-pdf-modal-frame">
            <iframe title="PDF resource full screen" src={embedSrc} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
