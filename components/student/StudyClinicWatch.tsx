"use client";

import Link from "next/link";
import LessonVideoParts from "@/components/lesson/LessonVideoParts";
import VideoPlayer from "@/components/lesson/VideoPlayer";
import PurchaseCta from "@/components/commerce/PurchaseCta";
import { isMultiVideoLesson, parseLessonVideos } from "@/lib/lesson-videos";
import type { StudentLesson } from "@/lib/student-lesson";

export default function StudyClinicWatch({
  lesson,
  purchaseLocked,
}: {
  lesson: StudentLesson;
  purchaseLocked?: boolean;
}) {
  const videos = lesson.videos?.length ? lesson.videos : parseLessonVideos(lesson.video_url);
  const multi = isMultiVideoLesson(lesson.type, videos);

  return (
    <article className="lesson-body wide">
      <p>
        <Link href="/student/study-clinic">← Study Clinic</Link>
      </p>
      <p className="kicker">Study Clinic</p>
      <h1>{lesson.title}</h1>
      {purchaseLocked ? (
        <>
          <p className="lead">{lesson.locked_message || "This video is part of the full course."}</p>
          <PurchaseCta />
        </>
      ) : (
        <>
          {lesson.blurb ? <p className="lead">{lesson.blurb}</p> : null}
          {multi ? <LessonVideoParts lesson={lesson} videos={videos} /> : <VideoPlayer lesson={lesson} src={videos[0]?.url} />}
        </>
      )}
    </article>
  );
}
