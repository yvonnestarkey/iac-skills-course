"use client";

import { useState } from "react";
import VideoPlayer from "@/components/lesson/VideoPlayer";
import { videoIdentity, videoPartHeading, type LessonVideo } from "@/lib/lesson-videos";
import type { Lesson } from "@/lib/types";

export default function LessonVideoParts({
  lesson,
  videos,
}: {
  lesson: Lesson;
  videos: LessonVideo[];
}) {
  const [openIndex, setOpenIndex] = useState(0);
  const total = videos.length;
  if (total < 2) return null;
  const open = videos[openIndex];
  if (!open) return null;

  return (
    <section className="lesson-video-parts" aria-label={`This lesson has ${total} parts`}>
      <p className="lesson-video-parts-count">This lesson has {total} parts</p>
      <div className="lesson-video-part-tabs" role="tablist" aria-label="Lesson video parts">
        {videos.map((video, index) => {
          const selected = index === openIndex;
          const heading = videoPartHeading(video, index, total);
          return (
            <button
              key={videoIdentity(video.url) || `${lesson.id}-part-${index}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="lesson-video-part-panel"
              id={`lesson-video-part-tab-${index}`}
              className={selected ? "lesson-video-part-tab is-open" : "lesson-video-part-tab"}
              onClick={() => setOpenIndex(index)}
            >
              {heading}
            </button>
          );
        })}
      </div>
      <div
        className="lesson-video-part-panel"
        role="tabpanel"
        id="lesson-video-part-panel"
        aria-labelledby={`lesson-video-part-tab-${openIndex}`}
      >
        <VideoPlayer lesson={lesson} src={open.url} title={videoPartHeading(open, openIndex, total)} />
        {open.after ? <p>{open.after}</p> : null}
        {openIndex < total - 1 ? (
          <div className="lesson-video-part-nav">
            <button type="button" className="ghost" onClick={() => setOpenIndex(openIndex + 1)}>
              Next part →
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
