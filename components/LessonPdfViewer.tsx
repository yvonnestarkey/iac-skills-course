"use client";

import { useEffect, useId, useState } from "react";
import { Download, Maximize2, X } from "lucide-react";
import { getLessonPdfUrl, type LessonPdfSource } from "@/lib/getLessonPdf";
import { asPdfUrl, pdfEmbedSrc } from "@/lib/lesson-resources";

export default function LessonPdfViewer({
  pdfUrl,
  lesson,
  heading = "PDF resource",
  blurb = "This file is for this lesson. It is not a submission.",
  downloadLabel = "Download PDF Resource",
}: {
  pdfUrl?: string | null;
  lesson?: LessonPdfSource | null;
  heading?: string;
  blurb?: string;
  downloadLabel?: string;
}) {
  const url = asPdfUrl(pdfUrl) || asPdfUrl(lesson?.pdf_url) || getLessonPdfUrl(lesson);
  const [fullScreen, setFullScreen] = useState(false);
  const [frameReady, setFrameReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const titleId = useId();
  const modalTitleId = useId();

  useEffect(() => {
    setFrameReady(false);
    setLoaded(false);
    if (!url) return;
    const frame = window.requestAnimationFrame(() => setFrameReady(true));
    const timeout = window.setTimeout(() => setLoaded(true), 1200);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [url]);

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
    <section className="lesson-pdf-viewer w-full" aria-labelledby={titleId}>
      <div className="lesson-pdf-header">
        <div>
          <h2 id={titleId}>{heading}</h2>
          {blurb ? <p className="muted">{blurb}</p> : null}
        </div>
        <div className="lesson-pdf-actions">
          <a className="primary lesson-pdf-download" href={url} target="_blank" rel="noopener noreferrer">
            <Download size={16} />
            {downloadLabel}
          </a>
          <button className="ghost" type="button" onClick={() => setFullScreen(true)}>
            <Maximize2 size={16} />
            Full Screen
          </button>
        </div>
      </div>
      <div
        className={`lesson-pdf-frame w-full h-[80vh] ${loaded ? "" : "lesson-pdf-frame--loading"}`}
        aria-busy={!loaded}
        aria-label={loaded ? undefined : "Loading PDF"}
      >
        {!loaded ? <div className="lesson-pdf-skeleton" /> : null}
        {frameReady ? (
          <iframe title="PDF resource" src={embedSrc} onLoad={() => setLoaded(true)} />
        ) : null}
      </div>
      {fullScreen ? (
        <div className="lesson-pdf-modal" role="dialog" aria-modal="true" aria-labelledby={modalTitleId}>
          <div className="lesson-pdf-modal-bar">
            <h2 id={modalTitleId}>{heading}</h2>
            <div className="lesson-pdf-actions">
              <a className="primary lesson-pdf-download" href={url} target="_blank" rel="noopener noreferrer">
                <Download size={16} />
                {downloadLabel}
              </a>
              <button className="ghost" type="button" onClick={() => setFullScreen(false)}>
                <X size={16} />
                Close
              </button>
            </div>
          </div>
          <div className="lesson-pdf-modal-frame">
            {frameReady ? <iframe title="PDF resource full screen" src={embedSrc} /> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
