"use client";

import Link from "next/link";
import LessonVideoParts from "@/components/lesson/LessonVideoParts";
import VideoPlayer from "@/components/lesson/VideoPlayer";
import { isMultiVideoLesson, parseLessonVideos } from "@/lib/lesson-videos";
import {
  clinicResourceHref,
  inferStudyClinicKind,
  studyClinicKindLabel,
  studyClinicSectionById,
  studyClinicSectionHref,
  type StudyClinicClip,
} from "@/lib/study-clinic";
import type { StudentLesson } from "@/lib/student-lesson";

function asWatchLesson(clip: StudyClinicClip): StudentLesson {
  const videos = parseLessonVideos(clip.video_urls);
  return {
    id: clip.id,
    type: "video",
    title: clip.title,
    chapterId: "study-clinic",
    chapterTitle: "Study Clinic",
    duration: clip.duration || undefined,
    blurb: clip.blurb || undefined,
    video_url: videos[0]?.url,
    videos,
    next: null,
    source: "supabase",
  };
}

export default function StudyClinicWatch({ clip }: { clip: StudyClinicClip }) {
  const lesson = asWatchLesson(clip);
  const videos = lesson.videos || [];
  const multi = isMultiVideoLesson("video", videos);
  const section = studyClinicSectionById(clip.section);
  const kind = inferStudyClinicKind(clip);
  const resource = clinicResourceHref(clip);

  return (
    <article className="lesson-body wide">
      <p>
        <Link href={section ? studyClinicSectionHref(section.id) : "/student/study-clinic"}>
          ← {section ? section.title : "Study Clinic"}
        </Link>
      </p>
      <p className="kicker">Study Clinic{section ? ` · ${section.title}` : ""}</p>
      <h1>{clip.title}</h1>
      {clip.blurb ? <p className="lead">{clip.blurb}</p> : null}
      {kind === "video" && videos.length ? (
        multi ? <LessonVideoParts lesson={lesson} videos={videos} /> : <VideoPlayer lesson={lesson} src={videos[0]?.url} />
      ) : resource?.external ? (
        <p>
          <a className="primary" href={resource.href} target="_blank" rel="noopener noreferrer">
            Open {studyClinicKindLabel(kind)}
          </a>
        </p>
      ) : (
        <p className="empty">This item does not have a file or video yet.</p>
      )}
    </article>
  );
}
