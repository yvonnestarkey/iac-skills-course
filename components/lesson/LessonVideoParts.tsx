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

  return (
    <section className="lesson-video-parts" aria-label={`This lesson has ${total} parts`}>
      <p className="lesson-video-parts-count">This lesson has {total} parts</p>
      <div className="lesson-video-accordion">
        {videos.map((video, index) => {
          const selected = index === openIndex;
          const heading = videoPartHeading(video, index, total);
          const panelId = `lesson-video-part-panel-${index}`;
          return (
            <article
              key={videoIdentity(video.url) || `${lesson.id}-part-${index}`}
              className={selected ? "lesson-video-item is-open" : "lesson-video-item"}
            >
              <button
                type="button"
                className="lesson-video-item-header"
                aria-expanded={selected}
                aria-controls={panelId}
                id={`lesson-video-part-tab-${index}`}
                onClick={() => setOpenIndex(index)}
              >
                <span>{heading}</span>
                <span className="lesson-video-item-chevron" aria-hidden="true">
                  {selected ? "▼" : "›"}
                </span>
              </button>
              {selected ? (
                <div className="lesson-video-item-body" id={panelId} role="region" aria-labelledby={`lesson-video-part-tab-${index}`}>
                  <div className="lesson-video-item-player">
                    <VideoPlayer lesson={lesson} src={video.url} title={heading} />
                    {video.after ? <p>{video.after}</p> : null}
                    {index < total - 1 ? (
                      <div className="lesson-video-part-nav">
                        <button type="button" className="ghost" onClick={() => setOpenIndex(index + 1)}>
                          Next part →
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
