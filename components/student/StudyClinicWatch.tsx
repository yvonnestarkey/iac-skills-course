"use client";

import Link from "next/link";
import LessonVideoParts from "@/components/lesson/LessonVideoParts";
import VideoPlayer from "@/components/lesson/VideoPlayer";
import { isMultiVideoLesson, parseLessonVideos } from "@/lib/lesson-videos";
import type { StudyClinicClip } from "@/lib/study-clinic";
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

  return (
    <article className="lesson-body wide">
      <p>
        <Link href="/student/study-clinic">← Study Clinic</Link>
      </p>
      <p className="kicker">Study Clinic</p>
      <h1>{clip.title}</h1>
      {clip.blurb ? <p className="lead">{clip.blurb}</p> : null}
      {videos.length ? (
        multi ? <LessonVideoParts lesson={lesson} videos={videos} /> : <VideoPlayer lesson={lesson} src={videos[0]?.url} />
      ) : (
        <p className="empty">This clip does not have a video URL yet.</p>
      )}
    </article>
  );
}
