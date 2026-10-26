"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import RichTextField from "@/components/ui/RichTextField";
import {
  LESSON_TYPES,
  updateLessonFields,
  uploadLessonBanner,
  uploadLessonPdf,
} from "@/lib/content";
import { firstLessonWebLink } from "@/lib/getLessonPdf";
import { invalidateCourseOutline, type StudentLesson } from "@/lib/student-lesson";
import { useStudentSession } from "@/lib/student-session";

function linesFrom(value: string[] | undefined): string {
  return (value || []).join("\n");
}

export default function CoachLessonEditor({ lesson }: { lesson: StudentLesson }) {
  const router = useRouter();
  const { reloadOutline } = useStudentSession();
  const webLink = firstLessonWebLink(lesson);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [title, setTitle] = useState(lesson.title);
  const [type, setType] = useState(lesson.type);
  const [duration, setDuration] = useState(lesson.duration || "");
  const [seconds, setSeconds] = useState(lesson.seconds ? String(lesson.seconds) : "");
  const [videoUrl, setVideoUrl] = useState(lesson.video_url || lesson.videos?.[0]?.url || "");
  const [blurb, setBlurb] = useState(lesson.blurb || "");
  const [body, setBody] = useState(linesFrom(lesson.body));
  const [takeaways, setTakeaways] = useState(linesFrom(lesson.takeaways));
  const [bannerUrl, setBannerUrl] = useState(lesson.banner_image_url || "");
  const [pdfUrl, setPdfUrl] = useState(lesson.pdf_url || "");
  const [resourceUrl, setResourceUrl] = useState(webLink?.url || "");
  const [resourceLabel, setResourceLabel] = useState(webLink?.title === "Open link" ? "" : webLink?.title || "");
  const [isDraft, setIsDraft] = useState(Boolean(lesson.is_draft));

  const teaching = type === "video" || type === "reading";

  const pickBanner = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    const result = await uploadLessonBanner(file);
    setBusy(false);
    if (!result.ok || !result.data) {
      setStatus(result.error || "Could not upload that image.");
      return;
    }
    setBannerUrl(result.data);
    setStatus("Banner image uploaded.");
  };

  const pickPdf = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    const result = await uploadLessonPdf(file);
    setBusy(false);
    if (!result.ok || !result.data) {
      setStatus(result.error || "Could not upload that PDF.");
      return;
    }
    setPdfUrl(result.data);
    setStatus("PDF uploaded.");
  };

  const save = async () => {
    if (!title.trim()) {
      setStatus("Give the lesson a title first.");
      return;
    }
    setBusy(true);
    const result = await updateLessonFields(lesson.id, {
      type,
      title: title.trim(),
      duration: duration.trim() || null,
      seconds: seconds ? Number(seconds) : null,
      blurb: blurb.trim() || null,
      body: body
        .split(/\n/)
        .map((line) => line.trim())
        .filter(Boolean),
      takeaways: takeaways
        .split(/\n/)
        .map((line) => line.trim())
        .filter(Boolean),
      video_url: videoUrl.trim() || null,
      banner_image_url: bannerUrl.trim() || null,
      pdf_url: pdfUrl.trim() || null,
      resource_downloads: resourceUrl.trim()
        ? [{ url: resourceUrl.trim(), title: resourceLabel.trim() || "Open link" }]
        : null,
      is_draft: isDraft,
    });
    setBusy(false);
    if (!result.ok) {
      setStatus(result.error || "Could not save that lesson.");
      return;
    }
    invalidateCourseOutline();
    await reloadOutline();
    setStatus(isDraft ? "Draft saved. Students cannot see this lesson." : "Lesson saved and visible to students.");
    router.refresh();
  };

  return (
    <section className="coach-lesson-editor">
      <button className="ghost" type="button" onClick={() => setOpen((current) => !current)}>
        {open ? "Close lesson editor" : "Edit lesson details"}
      </button>
      {open ? (
        <div className="coach-lesson-editor-form">
          <p className="muted small">
            Changes save to the live course. Keep it as a draft until you are ready for students to see it.
          </p>
          {status ? <p className="notice">{status}</p> : null}
          <div className="plan-field">
            <label htmlFor="in-course-title">
              <strong>Title</strong>
            </label>
            <input
              id="in-course-title"
              type="text"
              className="select-line"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="plan-field">
            <label htmlFor="in-course-type">
              <strong>Lesson type</strong>
            </label>
            <select
              id="in-course-type"
              className="select-line"
              value={type}
              onChange={(event) => setType(event.target.value as StudentLesson["type"])}
            >
              {LESSON_TYPES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          {teaching ? (
            <>
              <div className="plan-field">
                <label htmlFor="in-course-duration">
                  <strong>Duration</strong>
                </label>
                <div className="hours-row">
                  <input
                    id="in-course-duration"
                    type="text"
                    value={duration}
                    onChange={(event) => setDuration(event.target.value)}
                  />
                  {type === "video" ? (
                    <input
                      type="number"
                      min={30}
                      step={30}
                      placeholder="seconds"
                      value={seconds}
                      onChange={(event) => setSeconds(event.target.value)}
                    />
                  ) : null}
                </div>
              </div>
              {type === "video" ? (
                <div className="plan-field">
                  <label htmlFor="in-course-video">
                    <strong>Video URL</strong>
                  </label>
                  <input
                    id="in-course-video"
                    type="url"
                    className="select-line"
                    value={videoUrl}
                    onChange={(event) => setVideoUrl(event.target.value)}
                  />
                </div>
              ) : null}
              <div className="plan-field">
                <label htmlFor="in-course-blurb">
                  <strong>Lead line</strong>
                </label>
                <RichTextField id="in-course-blurb" rows={2} value={blurb} onChange={setBlurb} />
              </div>
              <div className="plan-field">
                <label htmlFor="in-course-body">
                  <strong>Body</strong>
                </label>
                <RichTextField
                  id="in-course-body"
                  rows={8}
                  value={body}
                  onChange={setBody}
                  hint="One paragraph per line."
                />
              </div>
              <div className="plan-field">
                <label htmlFor="in-course-takeaways">
                  <strong>Takeaways</strong>
                </label>
                <RichTextField id="in-course-takeaways" rows={3} value={takeaways} onChange={setTakeaways} />
              </div>
            </>
          ) : null}
          <div className="plan-field">
            <label htmlFor="in-course-pdf">
              <strong>PDF</strong>
            </label>
            <input
              id="in-course-pdf"
              type="url"
              className="select-line"
              value={pdfUrl}
              onChange={(event) => setPdfUrl(event.target.value)}
            />
            <input
              className="select-line"
              type="file"
              accept="application/pdf"
              onChange={(event) => {
                void pickPdf(event.target.files && event.target.files[0]);
                event.target.value = "";
              }}
            />
          </div>
          <div className="plan-field">
            <label htmlFor="in-course-resource">
              <strong>Resource link</strong>
            </label>
            <input
              id="in-course-resource"
              type="url"
              className="select-line"
              placeholder="https://…"
              value={resourceUrl}
              onChange={(event) => setResourceUrl(event.target.value)}
            />
            <input
              type="text"
              className="select-line"
              placeholder="Link label"
              value={resourceLabel}
              onChange={(event) => setResourceLabel(event.target.value)}
            />
          </div>
          <div className="plan-field">
            <label htmlFor="in-course-banner">
              <strong>Header banner image</strong>
            </label>
            <input
              id="in-course-banner"
              type="url"
              className="select-line"
              value={bannerUrl}
              onChange={(event) => setBannerUrl(event.target.value)}
            />
            <input
              className="select-line"
              type="file"
              accept="image/*"
              onChange={(event) => {
                void pickBanner(event.target.files && event.target.files[0]);
                event.target.value = "";
              }}
            />
          </div>
          <div className="plan-field">
            <label className="drip-active">
              <input type="checkbox" checked={isDraft} onChange={(event) => setIsDraft(event.target.checked)} />
              <strong>Keep as draft</strong>
            </label>
            <p className="muted small">Uncheck this to publish the lesson to students.</p>
          </div>
          <div className="actions">
            <button className="primary" type="button" disabled={busy} onClick={() => void save()}>
              {busy ? "Saving…" : "Save lesson"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
