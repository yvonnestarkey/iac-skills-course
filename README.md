# Accounting Study Advice — IAC Skills Course

Student learning portal and coach dashboard for Accounting Study Advice, built as a Next.js App Router project (TypeScript, React).

The original single-file prototype is kept, unchanged and still runnable, in `prototype/`. The Next.js app is a like-for-like port of it: same stylesheet, same markup, same behaviour.

## Project structure

```
app/
  layout.tsx                     root shell: fonts, globals.css, store, chat widget, behind-schedule modal
  globals.css                    the prototype stylesheet, unchanged
  page.tsx                       sign-in / role picker
  (student)/layout.tsx           top bar + course sidebar
  (student)/learn/[lessonId]/    one route per lesson, dispatched by lesson type
  (student)/planner/             personalised study planner
  coach/layout.tsx               top bar, full-width shell
  coach/page.tsx                 dashboard: stats, cohort filter, three tabs
  coach/students/[id]/           student profile
  api/calendar/[token]/route.ts  hosts each student's subscribed .ics feed
components/
  TopBar, Sidebar, ChatWidget, BehindModal
  lesson/                        teaching, assignment, upload, ask, survey lessons + video player
  planner/                       planner form, dated schedule, adjust panel, subscribe card
  coach/                         assignments tab, surveys tab, roster tab, student profile
lib/
  seed.ts                        course content, cohorts, live sessions, demo students
  types.ts constants.ts dates.ts
  course.ts metrics.ts           lesson helpers and coach statistics
  planner.ts                     capacity, session dating, packing, behind-detection
  ics.ts                         calendar document builder and feed URLs
  assistant.ts                   course assistant knowledge base and reply logic
  store.tsx                      client state + localStorage persistence
prototype/                       the original HTML/CSS/JS prototype and its Ruby server
tools/                           headless checks (no Node required)
```

State still lives entirely in the browser (`localStorage`), so no database or auth is involved. Everything that touches it is a client component; the only server code is the calendar feed route.

## Database (Supabase)

`.env.local` holds the project credentials (gitignored):

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
```

`lib/supabase.ts` creates the official `@supabase/supabase-js` client lazily and exports `supabaseConfigured`, so the UI can say the backend is missing instead of throwing. Sessions are not persisted by the client — the portal still keeps its own sign-in and student data in `localStorage`.

Course content is the first thing wired to the database. Create the table once, in the Supabase SQL editor:

```bash
supabase/schema.sql   # public.lessons + indexes + RLS policies
```

Worth knowing before launch: those policies let the publishable key both read *and* write `lessons`, because the portal has no coach sign-in yet. Once there is real auth, writes should be restricted to an authenticated coach role.

## Admin Content Manager

A fourth tab on `/coach`, next to Assignments, Module Surveys, and Student Roster.

- **Add a lesson** — pick the chapter and lesson type, and the form asks only for what that type needs: duration and body for video and reading, due date and brief for assignments and uploads, a lead line for Ask the Coach and surveys. New lesson ids follow the chapter's own numbering (`c1l7`), and new teaching work is inserted before that chapter's Ask the Coach and survey lessons so the module structure holds.
- **Import CSV** — choose a file or paste rows. Columns: `chapter, type, title, duration, seconds, blurb, body, takeaways, due, brief`, with a header row required. A pipe separates paragraphs or takeaways inside one cell. **Preview** lists the lessons it will create and names every row it had to skip, with the reason. `chapter` accepts `ch1`, `c1`, `1`, or part of the chapter title. **Download CSV template** gives you a working example.
- **Test connection** and **Load lessons from Supabase** — the first reports the row count or the exact Postgres error, the second pulls the table back into the course.
- **Course content** — every lesson with a Remove link. Lessons that already have student work show "in use" instead, so removing content cannot orphan a submission.

Additions appear in the student sidebar immediately (they go into the same client state as everything else) and, when "Also save to Supabase" is ticked, are upserted into `public.lessons` by id.

## Core assumption

Students will do the work inside one portal — watch the lesson, submit written working, upload a PDF of their attempt, and ask the coach there — and the coach can see who is behind and who is waiting on an answer without chasing across email and WhatsApp.

## Student portal (primary view)

- Left sidebar: course modules, Chapter 1–3, with per-lesson status and a course progress bar
- Main area: video player at the top, then lesson title, lead, body text, and takeaways
- Every chapter contains five lessons:
  - video / reading lessons
  - **Written assignment** — typed working in a submission box
  - **PDF upload** — student uploads a PDF for coach feedback
  - **Ask the Coach** — question thread

## Personalised study planner

A **Create My Study Plan** card sits at the top of the sidebar, above the modules. The planner page asks for three things: a **study start date**, hours available per week, and which sessions they can keep (Mon morning through Sun evening).

From that it dates **the whole course** — all three chapters — so the student can see the calendar date of every session and when they finish. The schedule regenerates live as they change anything.

Work estimates:

| Item | Estimate |
| --- | --- |
| Video | running time plus 12 minutes for notes |
| Reading | stated read time doubled, plus 6 minutes |
| Written assignment | 60 minutes |
| PDF upload | 40 minutes |

Each session is capped at the weekly hours divided by the number of sessions. Weeks are shown with real date ranges, completed items are ticked off, missed items are flagged, and a task spread over two sittings is labelled "part 1 of 2". Cohort Zoom sessions appear inline on their real dates. Ask the Coach is deliberately never scheduled.

### Behind-schedule prompt

When a student signs in, the planner compares today against their saved plan. If scheduled work is in the past and still not done, a dialog tells them how far behind they are, lists the missed items with the dates they were due, and offers **Revise my plan** or **Just keep learning**. Choosing to revise opens the planner with the Adjust me panel already open.

Jordan and Priya are seeded with plans that started in the past, so signing in as either triggers the prompt.

### Adjust me

A catch-up panel rather than a rebuild:

- **Move start to today** — re-dates a plan that has fallen behind
- **Add an hour a week** — raises the weekly budget
- **Add 2 make-up sessions** — drops in two extra evenings this week
- Add or remove individual make-up sessions with their own date, period, and length

### Subscribe to calendar (auto-updating)

The primary button in the planner hero. Subscribing publishes the student's plan as a hosted calendar feed at `/api/calendar/<token>.ics` and gives them a private feed address plus one-click links for Apple Calendar, Outlook, and Google Calendar.

Because it is a subscription rather than an import, **saving the plan republishes the feed** and the subscribed calendar picks the change up on its next refresh — no re-importing. The feed asks clients to re-check hourly (`REFRESH-INTERVAL` and `X-PUBLISHED-TTL`).

Event UIDs are stable per lesson and part, namespaced to the feed token, so rescheduling **moves** existing calendar entries instead of creating duplicates.

How it fits together: the browser owns the `.ics` generator and `PUT`s the finished document to the route handler at `app/api/calendar/[token]/route.ts`, which writes it to `calendars/` and hosts it for subscribers. That keeps one source of truth for the calendar format.

Two limits worth knowing for a real launch:

- Google Calendar fetches feeds from its own servers, so it cannot reach `localhost`. Running locally, use the Apple Calendar or Outlook link; a deployed version needs a public HTTPS address.
- Feed tokens are unguessable but unauthenticated, exactly like Google's own "secret address" iCal links. Anyone with the URL can read that student's schedule.
- The route writes feed files to disk, so it needs a normal Node server (`next start`) rather than a read-only serverless target.

### Download Planner

The secondary button writes a one-off `iac-skills-study-plan.ics`, importable into Google Calendar, Outlook, or Apple Calendar. It does not update afterwards. One event per scheduled item, with:

- the lesson title in the event summary
- a link straight to the lesson route (`/learn/<id>`)
- the chapter, the action to take, the estimate, and any due date
- a link to that chapter's Ask the Coach thread

Cohort Zoom sessions export as their own events with the Zoom link in both `LOCATION` and the description. Times are floating local: morning sessions at 09:00, evening at 18:30.

## Checks

The logic checks run against `prototype/app.js` with macOS's built-in JavaScript host, and the port checks are Ruby scripts — none of them need Node:

```bash
osascript -l JavaScript tools/plan-check.js   # planner dating, packing, behind-detection, .ics output
osascript -l JavaScript tools/dash-check.js   # cohort stats, tabs, surveys, profiles, notes
ruby tools/import-check.rb                    # every local import in app/ components/ lib/ resolves
ruby tools/ui-parity.rb                       # every class name the prototype rendered is still rendered
```

With Node installed, `npm run typecheck` and `npm run build` are the real gate.

## Course assistant (floating widget)

Bottom-right on every page. It answers from the course material and study-skills knowledge base, and escalates anything it cannot answer.

- Two starter prompts: *I'm struggling with procrastination* and *How do I fix my communication?*
- Also covers double entry, trial balances, statements that will not balance, adjustments, ratios, exam technique, PDF uploads, and every deadline
- Answers link straight to the relevant lesson
- **Send to Yvonne** posts the question into the student's Ask the Coach thread with the context "Course assistant", so it appears under Questions waiting on the coach dashboard

## Coach / admin dashboard

Reachable from the **View as** switcher in the top bar.

**Top stats**, all scoped by a cohort dropdown (Autumn 2026, Summer 2026, or all): cohort completion % with a bar, active students with a paused count, pending submissions, and average survey score out of 5. Students waiting on a reply are called out beneath the stats as direct links to their profiles.

**Three tabs:**

- **Assignments** — pick any of the six pieces of work, filter by all / missing / questions / received, and see a table of students with status, submission detail (word count or filename and size), whether they are waiting, and course progress. Nudge everyone missing skips paused students.
- **Module Surveys** — one card per chapter with an average per question, a response count, an overall score chip, and every written comment attributed to a student.
- **Student Roster** — full table: name and email, cohort, progress bar, submissions received, surveys returned, waiting flag, last active (highlighted when a week or more has passed), and active/paused status.

**Clickable student profiles.** Any row in any table, and any student name in the survey comments or waiting alert, opens a dedicated profile page:

- progress bar with a completion percentage over all 12 course items, plus submission, survey, and question counts
- their study planner settings: start date, hours per week, chosen sessions, session length, make-up sessions, projected finish date, and how far behind they are
- every assignment submission — typed working in full, and uploaded PDFs as file cards with an Open PDF button
- all module survey responses with per-question scores and their comment
- a **coach notes** area, private to you, with timestamped notes you can add and delete
- their Ask the Coach thread with a reply box

## Module surveys (student side)

Each chapter ends with a survey lesson: four 1–5 rating questions (clarity, pace, confidence, coach support) plus a free-text comment. Responses feed the average survey score and the Module Surveys tab. Surveys are never scheduled by the study planner.

## Brand

| Use | Colour |
| --- | --- |
| Dark elements (sidebar, player) | `#3f625c` |
| Light backgrounds | `#86b2a8` |
| Medium elements (buttons, active) | `#1f7b70` |
| Light elements (panels, badges) | `#e4d3bd` |
| Links and hover | `#990f49` |

Text is black throughout.

## PDF uploads

Files are held in the browser only. Up to about 3 MB is stored in `localStorage` so it survives a refresh; anything larger stays available for the current session only. Seeded example uploads show as received but cannot be opened, since no real file exists behind them.

## Out of scope

Real accounts, real video hosting, payments, grades, server-side file storage, email/SMS delivery, multiple courses.

## Run it

Needs Node 18.18 or newer.

```bash
npm install
npm run dev
```

Then visit http://localhost:3000

Published calendar feeds are written to `calendars/`, which is gitignored.

### The old prototype

Still runnable on its own, unchanged:

```bash
cd prototype && ruby server.rb    # http://127.0.0.1:8765
```

Use **Reset demo data** on the login screen to start over — Priya has a sample unanswered question.
