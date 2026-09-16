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
  survey_id?: string | null;
  is_assignment?: boolean;
  banner_image_url?: string | null;
}

/** Student BMCR (Basic Mark Conversion Ratio) evaluation for an assignment lesson. */
export interface BmcrEvaluation {
  id?: string;
  student_id: string;
  assignment_id: string;
  basic_my_marks: number;
  basic_markplan: number;
  average_my_marks: number;
  average_markplan: number;
  higher_my_marks: number;
  higher_markplan: number;
  question_total_my_marks: number;
  question_total_markplan: number;
  basic_mark_pct?: number;
  bmcr_conversion_pct?: number;
  challenges: string[];
  key_takeaways: string;
  feels_needs_theory?: boolean | null;
  feelings_reliable?: boolean | null;
  submitted_at?: string;
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
  phone_number?: string | null;
  accountability_email?: string | null;
  last_active?: string | null;
  created_at?: string;
}

export interface StudentProfile {
  student_id: string;
  demographics: Record<string, unknown>;
  qualitative_notes: Record<string, unknown>;
  onboarding_completed: boolean;
  onboarding_skipped?: boolean;
  updated_at?: string;
}

export interface CoachRosterPreferences {
  coach_id: string;
  visible_columns: string[];
  updated_at?: string;
}

export interface CoachingPageConfig {
  id: number;
  title: string;
  description: string;
  calendly_url: string;
  banner_image_url: string | null;
  dashboard_banner_url?: string | null;
  recording_section_title?: string | null;
  recording_section_description?: string | null;
  recording_button_label?: string | null;
  pdf_button_label?: string | null;
  live_calendar_ics_url?: string | null;
  live_calendar_tooltip_text?: string | null;
}

export interface LiveSession {
  id: string;
  title: string;
  description?: string | null;
  session_at: string;
  status: "upcoming" | "completed" | "cancelled";
  zoom_url?: string | null;
  recording_url?: string | null;
  summary_pdf_url?: string | null;
  notes_pdf_url?: string | null;
}

export interface StudentCoachingSession {
  id: string;
  student_id: string;
  status: "scheduled" | "completed" | "cancelled";
  session_at?: string | null;
  fireflies_pdf_url?: string | null;
  vimeo_recording_url?: string | null;
  recording_url?: string | null;
  pdf_summary_url?: string | null;
  coach_notes?: string | null;
  deliverables_seen_at?: string | null;
}

export interface CustomSurveyRow {
  id: string;
  title: string;
  description: string;
  slug: string;
  is_active: boolean;
  questions: unknown;
  created_at: string;
  updated_at: string;
}

export interface CustomSurveyResponseRow {
  id: string;
  survey_id: string;
  student_id: string;
  answers: Record<string, unknown>;
  created_at: string;
}
