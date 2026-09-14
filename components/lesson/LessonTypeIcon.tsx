"use client";

import { BookOpen, Check, Download, FileCheck, HelpCircle, PlayCircle, Star, Upload } from "lucide-react";
import { displayLessonType } from "@/lib/lesson-type";

export default function LessonTypeIcon({
  type,
  title,
  done = false,
  size = 14,
}: {
  type?: string | null;
  title?: string | null;
  done?: boolean;
  size?: number;
}) {
  if (done) return <Check size={size} aria-hidden="true" />;
  const kind = displayLessonType({ type, title });
  const props = { size, "aria-hidden": true as const };
  if (kind === "download") return <Download {...props} />;
  if (kind === "upload") return <Upload {...props} />;
  if (kind === "assignment") return <FileCheck {...props} />;
  if (kind === "video") return <PlayCircle {...props} />;
  if (kind === "reading") return <BookOpen {...props} />;
  if (kind === "ask") return <HelpCircle {...props} />;
  if (kind === "survey") return <Star {...props} />;
  return <BookOpen {...props} />;
}
