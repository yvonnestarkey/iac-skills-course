import type { LessonResourceDownload } from "./lesson-resources";

export type LessonType = "video" | "reading" | "assignment" | "upload" | "ask" | "survey";

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
  resource_downloads?: LessonResourceDownload[];
}

export interface Chapter {
  id: string;
  title: string;
  summary: string;
  lessons: Lesson[];
}

/** A lesson with its parent chapter attached, as the planner and coach views need. */
export interface FlatLesson extends Lesson {
  chapter: Chapter;
}

export interface Cohort {
  id: string;
  name: string;
  starts?: string;
  current?: boolean;
}

export interface LiveSession {
  id: string;
  title: string;
  date: string;
  time: string;
  minutes: number;
  zoom: string;
}

export interface UploadRecord {
  name: string;
  size: number;
  at: string;
  dataUrl?: string;
  legacy?: boolean;
}

export interface SurveyAnswer {
  clarity?: number;
  pace?: number;
  confidence?: number;
  support?: number;
  comment?: string;
}

export interface MakeupSession {
  date: string;
  period: "morning" | "afternoon" | "evening";
  minutes: number;
}

export interface StudyPlan {
  startDate: string;
  hours: number;
  slots: string[];
  makeups: MakeupSession[];
}

export interface CalendarFeed {
  token: string;
  subscribed?: boolean;
  updatedAt?: string;
  events?: number;
  failed?: boolean;
}

export interface CoachNote {
  text: string;
  at: string;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  cohort: string;
  status: "active" | "paused";
  joined?: string;
  lastActive?: string;
  // All optional: the UI reads them defensively and seeds may omit them.
  completed?: string[];
  submissions?: Record<string, string>;
  uploads?: Record<string, UploadRecord>;
  surveys?: Record<string, SurveyAnswer>;
  notes?: CoachNote[];
  plan?: StudyPlan;
  calendar?: CalendarFeed;
}

export interface Message {
  from: "coach" | "student";
  text: string;
  at: string;
  kind?: "question";
  context?: string;
}

export type CommunicationAudience = "student" | "cohort" | "filtered" | "selected" | "all";

export interface CommunicationReply {
  id: string;
  from: "coach" | "student";
  authorId: string;
  text: string;
  at: string;
}

/** One announcement and every reply to it — the audit trail. */
export interface Communication {
  id: string;
  subject: string;
  body: string;
  at: string;
  audience: CommunicationAudience;
  audienceLabel: string;
  recipientIds: string[];
  readBy: string[];
  replies: CommunicationReply[];
}

export interface ChatEntry {
  from: "you" | "bot";
  text?: string;
  paragraphs?: string[];
  lessonId?: string;
  offerEscalate?: boolean;
  escalated?: boolean;
  unknown?: boolean;
  about?: string;
}

export interface CourseData {
  company: string;
  className: string;
  term: string;
  cohorts: Cohort[];
  liveSessions: LiveSession[];
  chapters: Chapter[];
  students: Student[];
  messages: Record<string, Message[]>;
  chats: Record<string, ChatEntry[]>;
  communications?: Communication[];
}

/** One dated study session with the work packed into it. */
export interface ScheduledSession {
  date: Date;
  period: "morning" | "afternoon" | "evening";
  capacity: number;
  slotId: string;
  makeup?: boolean;
  used: number;
  items: ScheduledItem[];
}

export interface ScheduledItem {
  lesson: FlatLesson;
  minutes: number;
  part?: number;
  parts?: number;
}

export interface PlanStatus {
  plan: StudyPlan;
  cells: ScheduledSession[];
  overdue: { lesson: FlatLesson; date: Date }[];
  remaining: number;
  unplaced: number;
  finish: Date | null;
}
