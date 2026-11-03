"use client";

import { useEffect, useState } from "react";
import { formatSastDateTime } from "@/lib/dates";
import {
  deleteStudentPdf,
  listStudentPdfs,
  uploadStudentPdf,
  type StudentPdf,
} from "@/lib/student-pdfs";

export default function StudentPdfsPanel({ studentId }: { studentId: string }) {
  const [files, setFiles] = useState<StudentPdf[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const load = async () => {
    const result = await listStudentPdfs(studentId);
    setFiles(result.files);
    setError(result.error || "");
    setReady(true);
  };

  useEffect(() => {
    void load();
  }, [studentId]);

  const upload = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setError("");
    const result = await uploadStudentPdf(studentId, file, title);
    setBusy(false);
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    setTitle("");
    await load();
  };

  const remove = async (file: StudentPdf) => {
    if (!window.confirm(`Remove “${file.title || file.fileName}” from this repository?`)) return;
    setBusy(true);
    const result = await deleteStudentPdf(file);
    setBusy(false);
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    await load();
  };

  return (
    <section className="card">
      <div className="panel-head">
        <div>
          <h2>PDF repository</h2>
          <p className="muted small">
            Files they send by email that are not a course submission. Private to you — students do not see this
            list.
          </p>
        </div>
      </div>
      {error ? <p className="waiting">{error}</p> : null}
      <div className="student-pdfs-upload">
        <label className="student-notes-label" htmlFor="student-pdf-title">
          Label (optional)
        </label>
        <input
          id="student-pdf-title"
          className="select-line"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Emailed 3 Nov — extra script"
          disabled={busy}
        />
        <input
          className="select-line"
          type="file"
          accept="application/pdf,.pdf"
          disabled={busy}
          onChange={(event) => {
            void upload(event.target.files && event.target.files[0]);
            event.target.value = "";
          }}
        />
        <p className="muted small">{busy ? "Uploading…" : "Choose a PDF to add it to this student."}</p>
      </div>
      {!ready ? <p className="empty">Loading PDFs…</p> : null}
      {ready && !files.length ? <p className="empty">No emailed PDFs filed yet.</p> : null}
      {files.map((file) => (
        <div className="work-item" key={file.id}>
          <div className="work-head">
            <strong>{file.title || file.fileName}</strong>
            <span className="muted small">{file.createdAt ? formatSastDateTime(file.createdAt) : ""}</span>
          </div>
          {file.title && file.title !== file.fileName ? <p className="muted small">{file.fileName}</p> : null}
          <div className="actions">
            <a className="ghost" href={file.fileUrl} target="_blank" rel="noopener noreferrer">
              Open PDF
            </a>
            <button className="ghost" type="button" disabled={busy} onClick={() => void remove(file)}>
              Remove
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
