"use client";

import { Download, FileText } from "lucide-react";
import type { LessonResourceDownload } from "@/lib/lesson-resources";

export default function LessonResources({
  resources,
}: {
  resources?: LessonResourceDownload[] | null;
}) {
  const files = (resources || []).filter((item) => item.url);
  if (!files.length) return null;

  return (
    <section className="lesson-resources" aria-labelledby="lesson-resources-heading">
      <h2 id="lesson-resources-heading">Downloadable Resources</h2>
      <p className="muted">These files are for this lesson. They are not a submission.</p>
      <ul>
        {files.map((file) => (
          <li key={`${file.url}-${file.title}`} className="lesson-resource">
            <span className="lesson-resource-icon" aria-hidden="true">
              <FileText size={18} />
            </span>
            <span className="lesson-resource-meta">
              <strong>{file.title}</strong>
              {file.file_size ? <span className="muted small">{file.file_size}</span> : null}
            </span>
            <a
              className="ghost lesson-resource-download"
              href={file.url}
              download
              target="_blank"
              rel="noopener noreferrer"
            >
              <Download size={14} />
              Download
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
