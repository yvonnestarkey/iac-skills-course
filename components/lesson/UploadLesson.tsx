"use client";

import { useRef } from "react";
import type { ChangeEvent } from "react";
import { fileFor } from "@/lib/course";
import { formatSize, nowLabel } from "@/lib/dates";
import { MAX_INLINE_BYTES, fileHref, sessionFiles, useStore } from "@/lib/store";
import type { FlatLesson, UploadRecord } from "@/lib/types";
import { LessonHeader, NextLessonButton } from "./LessonChrome";

export default function UploadLesson({ lesson }: { lesson: FlatLesson }) {
  const { student, mutate, notice, setNotice } = useStore();
  const input = useRef<HTMLInputElement>(null);
  if (!student) return null;

  const file = fileFor(student, lesson.id);
  const href = file ? fileHref(student.id, lesson.id, file) : "";
  const key = `${student.id}:${lesson.id}`;

  const store = (record: UploadRecord, message: string) => {
    const persisted = mutate((data) => {
      const target = data.students.find((s) => s.id === student.id);
      target.uploads = target.uploads || {};
      target.uploads[lesson.id] = record;
    });
    setNotice(persisted ? message : "Uploaded for this session. The file was too large to keep after a refresh.");
  };

  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files && event.target.files[0];
    if (!picked) return;
    const isPdf = picked.type === "application/pdf" || picked.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setNotice("That file is not a PDF. Export or scan your work as a PDF and try again.");
      return;
    }
    const record: UploadRecord = { name: picked.name, size: picked.size, at: nowLabel() };

    if (picked.size > MAX_INLINE_BYTES) {
      sessionFiles[key] = URL.createObjectURL(picked);
      store(record, "Uploaded. This file is large, so it stays available until you refresh.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      record.dataUrl = String(reader.result);
      sessionFiles[key] = record.dataUrl;
      store(record, "");
    };
    reader.onerror = () => setNotice("That file could not be read. Try exporting it again.");
    reader.readAsDataURL(picked);
  };

  const remove = () => {
    mutate((data) => {
      const target = data.students.find((s) => s.id === student.id);
      delete target.uploads[lesson.id];
    });
    delete sessionFiles[key];
    setNotice("");
    if (input.current) input.current.value = "";
  };

  return (
    <article className="lesson-body wide">
      <LessonHeader lesson={lesson} />
      <p className="lead">Due {lesson.due}</p>
      {file ? <div className="notice">PDF received. Upload a new file to replace it.</div> : null}
      {notice ? <div className="waiting">{notice}</div> : null}
      <p>{lesson.brief}</p>
      {file ? (
        <div className="file-card">
          <span className="file-icon">PDF</span>
          <div className="file-meta">
            <strong>{file.name}</strong>
            <span className="muted small">
              {formatSize(file.size)} · uploaded {file.at}
            </span>
          </div>
          {href ? (
            <a className="ghost" href={href} target="_blank" rel="noopener">
              Open PDF
            </a>
          ) : (
            <span className="muted small">Not viewable in this browser</span>
          )}
          <button className="ghost" id="remove-file" onClick={remove}>
            Remove
          </button>
        </div>
      ) : null}
      <label className="dropzone" htmlFor="pdf">
        <strong>{file ? "Replace your PDF" : "Choose a PDF to upload"}</strong>
        <span className="muted small">PDF only · up to about 3 MB · scans are fine</span>
        <input id="pdf" ref={input} type="file" accept="application/pdf" onChange={onPick} />
      </label>
      <div className="actions">
        <NextLessonButton lesson={lesson} />
      </div>
    </article>
  );
}
