export type LessonType = "video" | "reading" | "assignment" | "upload" | "ask" | "survey" | "download";

export type SubmissionStatus = "submitted" | "approved" | "rejected";

export type UserRole = "student" | "coach" | "admin";

/** Canonical lesson row used by student and coach preview. */
export interface Lesson {
  id: string;
  type: LessonType;
  title: string;
  duration?: string;
  seconds?: number;
  video_duration_seconds?: number;
  estimated_read_minutes?: number;
  duration_minutes?: number;
  video_url?: string;
  blurb?: string;
  body?: string[];
  takeaways?: string[];
  due?: string;
  brief?: string;
  requires_submission?: boolean;
  requires_coach_approval?: boolean;
  prereq_lesson_id?: string | null;
  pdf_url?: string;
  resource_downloads?: unknown;
  unlock_at?: string | null;
}

/** Student work submitted for a gated lesson. */
export interface Submission {
  id?: string;
  student_id: string;
  lesson_id: string;
  body: string;
  link_url: string;
  status: SubmissionStatus;
  updated_at?: string;
}

/** Signed-in account in `public.profiles`. */
export interface UserProfile {
  id: string;
  email: string | null;
  full_name?: string | null;
  role: string | null;
  cohort?: string;
  last_active?: string | null;
  created_at?: string;
}
