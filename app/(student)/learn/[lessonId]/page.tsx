"use client";

import { useParams } from "next/navigation";
import AskLesson from "@/components/lesson/AskLesson";
import AssignmentLesson from "@/components/lesson/AssignmentLesson";
import SurveyLesson from "@/components/lesson/SurveyLesson";
import TeachingLesson from "@/components/lesson/TeachingLesson";
import UploadLesson from "@/components/lesson/UploadLesson";
import { findLesson } from "@/lib/course";
import { useStore } from "@/lib/store";

export default function LessonPage() {
  const { data } = useStore();
  const params = useParams<{ lessonId: string }>();
  const lesson = findLesson(data, params.lessonId);

  // Keyed by lesson so each lesson gets its own draft state.
  if (lesson.type === "assignment") return <AssignmentLesson key={lesson.id} lesson={lesson} />;
  if (lesson.type === "upload") return <UploadLesson key={lesson.id} lesson={lesson} />;
  if (lesson.type === "ask") return <AskLesson key={lesson.id} lesson={lesson} />;
  if (lesson.type === "survey") return <SurveyLesson key={lesson.id} lesson={lesson} />;
  return <TeachingLesson key={lesson.id} lesson={lesson} />;
}
