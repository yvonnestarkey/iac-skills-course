-- Extra PDFs for the student 1-on-1 board. coach_notes is the pasted Executive Summary.
alter table student_coaching_sessions
  add column if not exists pdf_files jsonb not null default '[]'::jsonb;

comment on column student_coaching_sessions.pdf_files is
  'Session PDFs [{url, name}] shown as pills on the student 1-on-1 board.';

comment on column student_coaching_sessions.coach_notes is
  'Coach-pasted executive summary / take-aways for the student 1-on-1 board.';
