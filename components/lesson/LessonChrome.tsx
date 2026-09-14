"use client";

import LessonTypeIcon from "@/components/lesson/LessonTypeIcon";
import { displayLessonType, lessonTypeLabel } from "@/lib/lesson-type";
import { useRouter } from "next/navigation";
import { allLessons } from "@/lib/course";
import { useStore } from "@/lib/store";
import type { FlatLesson } from "@/lib/types";

export function LessonHeader({ lesson, kicker }: { lesson: FlatLesson; kicker?: string }) {
  const kind = displayLessonType(lesson);
  return (
    <>
      <p className="kicker">
        <LessonTypeIcon type={kind} title={lesson.title} size={13} />
        {kicker || lessonTypeLabel(kind)}
      </p>
      <h1>{lesson.title}</h1>
    </>
  );
}

export function NextLessonButton({ lesson }: { lesson: FlatLesson }) {
  const { data, setNotice } = useStore();
  const router = useRouter();
  const lessons = allLessons(data);
  const index = lessons.findIndex((l) => l.id === lesson.id);
  const next = lessons[index + 1];
  if (!next) return null;
  return (
    <button
      className="ghost"
      onClick={() => {
        setNotice("");
        router.push(`/learn/${next.id}`);
      }}
    >
      Next: {next.title} →
    </button>
  );
}
