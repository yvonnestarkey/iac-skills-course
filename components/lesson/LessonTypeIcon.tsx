"use client";

import { BookOpen, Check, Download, FileCheck, HelpCircle, MousePointerClick, PlayCircle, Star, Upload } from "lucide-react";
import { displayLessonType } from "@/lib/lesson-type";
import { isInteractiveLesson } from "@/lib/reading-drills";

export default function LessonTypeIcon({
  type,
  title,
  tool,
  id,
  done = false,
  size = 14,
}: {
  type?: string | null;
  title?: string | null;
  tool?: string | null;
  id?: string | null;
  done?: boolean;
  size?: number;
}) {
  if (done) return <Check size={size} aria-hidden="true" />;
  const props = { size, "aria-hidden": true as const };
  if (isInteractiveLesson({ id, title, tool })) return <MousePointerClick {...props} />;
  const kind = displayLessonType({ type, title });
  if (kind === "download") return <Download {...props} />;
  if (kind === "upload") return <Upload {...props} />;
  if (kind === "assignment") return <FileCheck {...props} />;
  if (kind === "video") return <PlayCircle {...props} />;
  if (kind === "reading") return <BookOpen {...props} />;
  if (kind === "ask") return <HelpCircle {...props} />;
  if (kind === "survey") return <Star {...props} />;
  return <BookOpen {...props} />;
}
