/**
 * Extract the IAC Skills Course from Thinkific after you log in by hand.
 *
 * Install (once):
 *   npm install -D playwright tsx
 *   npx playwright install chromium
 *
 * Run (opens your installed Chrome, not Playwright Chromium):
 *   npx tsx scripts/scrape-thinkific.ts
 *   npx tsx scripts/scrape-thinkific.ts https://YOUR-SCHOOL.thinkific.com/courses/take/iac-skills-course
 *
 * Log in, open the IAC Skills Course player if it is not already there, then press Enter in this terminal.
 */

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { access, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "playwright";

function argValue(flag: string): string | undefined {
  const prefix = `${flag}=`;
  const hit = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() : undefined;
}

const OUT_FILE = path.resolve(process.cwd(), argValue("--out") || "iac-skills-course.json");
const COURSE_NAME = argValue("--name") || "Imported course";
const GO_FILE = path.join(process.cwd(), ".thinkific-scrape-go");
const PROFILE_DIR = path.join(process.cwd(), ".thinkific-chrome");
const START_URL =
  process.argv.slice(2).find((arg) => !arg.startsWith("--")) ||
  process.env.THINKIFIC_COURSE_URL ||
  "https://courses.accountingstudyadvice.com/courses/take/iac-skills-course-jan-2027/texts/78028899-course-dates-details";

type LessonType = "video" | "reading" | "assignment" | "upload" | "download" | "ask" | "survey";

interface ScrapedLesson {
  id: string;
  type: LessonType;
  title: string;
  videoUrls: string[];
  body: string[];
  thinkificUrl: string;
  thinkificKind?: string;
}

interface ScrapedChapter {
  id: string;
  title: string;
  summary: string;
  lessons: ScrapedLesson[];
}

interface OutlineItem {
  chapterTitle: string;
  lessonTitle: string;
  href: string;
}

function slug(value: string, fallback: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return cleaned || fallback;
}

async function waitForEnter(message: string): Promise<void> {
  try {
    await unlink(GO_FILE);
  } catch {
    /* no leftover start file */
  }
  console.log(message);
  const rl = createInterface({ input, output });
  await Promise.race([
    rl.question("").then(() => "enter"),
    (async () => {
      while (true) {
        try {
          await access(GO_FILE);
          return "file";
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
      }
    })(),
  ]);
  rl.close();
  try {
    await unlink(GO_FILE);
  } catch {
    /* already removed */
  }
}

function typeFromHref(href: string): LessonType | null {
  const pathName = new URL(href, "https://example.com").pathname.toLowerCase();
  if (pathName.includes("/videos/") || pathName.includes("/video")) return "video";
  if (pathName.includes("/assignments/") || pathName.includes("/assignment")) return "assignment";
  if (pathName.includes("/surveys/") || pathName.includes("/survey")) return "survey";
  if (pathName.includes("/quizzes/") || pathName.includes("/quiz")) return "survey";
  if (pathName.includes("/downloads/") || pathName.includes("/pdfs/")) return "download";
  if (pathName.includes("/texts/") || pathName.includes("/pdf")) return "reading";
  return null;
}

function typeFromKind(kind: string | undefined, videoUrls: string[]): LessonType {
  const value = (kind || "").toLowerCase();
  if (value.includes("video")) return "video";
  if (value.includes("assignment")) return "assignment";
  if (value.includes("quiz") || value.includes("survey")) return "survey";
  if (value.includes("download") || value.includes("pdf")) return "download";
  if (value.includes("file")) return "upload";
  if (videoUrls.length) return "video";
  return "reading";
}

function absUrl(href: string, origin: string): string | null {
  try {
    const url = new URL(href, origin);
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

async function collectOutline(page: Page, origin: string): Promise<OutlineItem[]> {
  const result = await page.evaluate(`((siteOrigin) => {
      const items = [];
      const seen = new Set();

      const cleanTitle = (value) =>
        (value || "")
          .replace(/\\s+/g, " ")
          .replace(/\\s*·\\s*Draft.*$/i, "")
          .replace(/\\s*·\\s*PREREQUISITE.*$/i, "")
          .replace(/\\s+(Text|Video|Survey|Quiz|Assignment|PDF|Testimonials|One-on-one|Live Sessions)\\s*$/i, "")
          .trim();

      const chapterTitleFor = (link) => {
        let node = link.parentElement;
        for (let i = 0; i < 14 && node; i += 1) {
          const label = node.querySelector(
            "h2, h3, h4, [class*='section__title'], [class*='chapter-title'], [class*='ChapterTitle'], [class*='chapter__title'], [class*='chapter-header']"
          );
          if (label) {
            const text = (label.innerText || "").replace(/\\s+/g, " ").trim();
            if (
              text &&
              text.length < 160 &&
              !/^(chapters|chapter|search by lesson title|completed)$/i.test(text) &&
              !/complete|search by lesson/i.test(text)
            ) {
              return text;
            }
          }
          const heading = node.getAttribute && (node.getAttribute("data-chapter-title") || node.getAttribute("aria-label"));
          if (heading && heading.length < 160) return heading.replace(/\\s+/g, " ").trim();
          node = node.parentElement;
        }
        return "Untitled chapter";
      };

      Array.from(document.querySelectorAll("a[href]")).forEach((link) => {
        let full = "";
        try {
          const url = new URL(link.getAttribute("href") || "", siteOrigin);
          url.hash = "";
          full = url.toString();
        } catch (err) {
          return;
        }
        if (seen.has(full)) return;
        if (!/\\/courses\\/take\\//i.test(full)) return;
        if (!/\\/(texts|videos|surveys|quizzes|assignments|pdfs|downloads|lessons)\\//i.test(full)) return;
        const lessonTitle = cleanTitle(link.textContent);
        if (!lessonTitle || /^skip to /i.test(lessonTitle)) return;
        seen.add(full);
        items.push({
          chapterTitle: chapterTitleFor(link),
          lessonTitle,
          href: full,
        });
      });

      return items;
    })(${JSON.stringify(origin)})`);
  return Array.isArray(result) ? (result as OutlineItem[]) : [];
}

async function extractLesson(page: Page): Promise<{ title: string; body: string[]; videoUrls: string[]; kind: string }> {
  const result = await page.evaluate(`(() => {
    const titleEl = document.querySelector(
      "h1, .course-player__content-header-title, .lecture-title, .lesson-title, [class*='LessonTitle'], [class*='content-header'] h2, [data-testid='lesson-title']"
    );
    const rawTitle = (titleEl && titleEl.innerText && titleEl.innerText.trim()) || "";
    const title = /accounting study advice/i.test(rawTitle) ? "" : rawTitle;

    const videoUrls = [
      ...Array.from(document.querySelectorAll("iframe[src]")).map((el) => el.getAttribute("src") || ""),
      ...Array.from(document.querySelectorAll("video source[src], video[src]")).map(
        (el) => el.getAttribute("src") || ""
      ),
      ...Array.from(document.querySelectorAll("[data-video-id], [data-wistia-id], [data-vimeo-id]")).flatMap((el) => {
        const wistia = el.getAttribute("data-wistia-id");
        const vimeo = el.getAttribute("data-vimeo-id");
        const src = el.getAttribute("data-src") || "";
        const urls = [];
        if (wistia) urls.push("https://fast.wistia.net/embed/iframe/" + wistia);
        if (vimeo) urls.push("https://player.vimeo.com/video/" + vimeo);
        if (src) urls.push(src);
        return urls;
      }),
    ]
      .map((src) => src.trim())
      .filter((src) => /vimeo|wistia|youtube|youtu\\.be|player\\.|video/i.test(src));

    const uniqueVideos = [...new Set(videoUrls)];

    const root =
      document.querySelector(".fr-view, .lecture-content, .lesson-content, [class*='LessonContent']") ||
      document.querySelector("article, main") ||
      document.body;

    const body = Array.from(root.querySelectorAll("p, li, h2, h3, .fr-view div"))
      .map((node) => node.innerText.replace(/\\s+/g, " ").trim())
      .filter((text) => text.length > 24)
      .filter((text, index, list) => list.indexOf(text) === index)
      .slice(0, 60);
    if (!body.length && root && root.innerText) {
      body.push(
        ...root.innerText
          .split(/\\n+/)
          .map((text) => text.replace(/\\s+/g, " ").trim())
          .filter((text) => text.length > 24)
          .slice(0, 40)
      );
    }

    const kindEl = document.querySelector("[class*='lesson-type'], .content-type, .lecture-type");
    const kind = (kindEl && kindEl.textContent && kindEl.textContent.trim()) || (uniqueVideos.length ? "video" : "reading");

    return { title, body, videoUrls: uniqueVideos, kind };
  })()`);
  return (
    (result as { title: string; body: string[]; videoUrls: string[]; kind: string }) || {
      title: "",
      body: [],
      videoUrls: [],
      kind: "reading",
    }
  );
}

async function waitForCoursePlayer(page: Page, origin: string): Promise<OutlineItem[]> {
  const deadline = Date.now() + 8 * 60 * 1000;
  let lastCount = 0;
  while (Date.now() < deadline) {
    await expandChapters(page);
    const outline = await collectOutline(page, origin);
    if (outline.length >= 3) return outline;
    if (outline.length !== lastCount) {
      lastCount = outline.length;
      console.log(`Waiting for the Thinkific player… ${outline.length} lesson link(s) so far.`);
    }
    const body = ((await page.textContent("body").catch(() => "")) || "").toLowerCase();
    if (body.includes("sign in") || body.includes("log in")) {
      console.log("Thinkific is asking you to sign in in the Chrome window this script opened. Log in there; I will continue when the course appears.");
    }
    await page.waitForTimeout(2500);
  }
  return collectOutline(page, origin);
}

async function expandChapters(page: Page): Promise<void> {
  const toggles = page.locator(
    ".course-player__chapter-header, .course-section__header, button[aria-expanded='false'], [class*='chapter'] button"
  );
  const count = await toggles.count();
  for (let i = 0; i < Math.min(count, 40); i += 1) {
    try {
      await toggles.nth(i).click({ timeout: 800 });
      await page.waitForTimeout(150);
    } catch {
      /* collapsed controls that are not clickable */
    }
  }
}

async function main() {
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    channel: "chrome",
    slowMo: 40,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });
  await context.addInitScript("Object.defineProperty(navigator, 'webdriver', { get: () => undefined });");
  const page = context.pages()[0] || (await context.newPage());

  const alreadyInPlayer = /\/courses\/take\//i.test(START_URL);
  console.log(`Opening ${START_URL}`);
  if (!alreadyInPlayer) {
    console.log("Log into Thinkific in the Chrome window this script opened, then open the course player.");
  }
  await page.goto(START_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);

  const origin = new URL(page.url()).origin;
  const outline = await waitForCoursePlayer(page, origin);
  if (!outline.length) {
    if (!alreadyInPlayer) {
      await waitForEnter("Press Enter here when you are logged in and the course is visible… ");
    }
    await expandChapters(page);
  }
  const readyOutline = outline.length ? outline : await collectOutline(page, origin);
  if (!readyOutline.length) {
    console.error("No chapter/lesson links found on this page. Stay on the Thinkific course player and try again.");
    await context.close();
    process.exit(1);
  }

  console.log(`Found ${readyOutline.length} lessons. Crawling…`);

  const chapters: ScrapedChapter[] = [];
  const chapterIndex = new Map<string, ScrapedChapter>();

  for (const item of readyOutline) {
    const href = absUrl(item.href, origin);
    if (!href) continue;

    let chapter = chapterIndex.get(item.chapterTitle);
    if (!chapter) {
      chapter = {
        id: `ch${chapters.length + 1}`,
        title: item.chapterTitle,
        summary: "",
        lessons: [],
      };
      chapterIndex.set(item.chapterTitle, chapter);
      chapters.push(chapter);
    }

    console.log(`  ${chapter.title} · ${item.lessonTitle || href}`);
    try {
      await page.goto(href, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForSelector(".fr-view, iframe[src*='vimeo'], iframe[src*='wistia'], video", { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(400);
      const extracted = await extractLesson(page);
      const type = extracted.videoUrls.length
        ? "video"
        : typeFromKind(`${extracted.kind} ${item.lessonTitle}`, extracted.videoUrls) ||
          typeFromHref(href) ||
          "reading";
      const lessonNumber = chapter.lessons.length + 1;
      chapter.lessons.push({
        id: `${slug(chapter.id, "ch")}-l${lessonNumber}`,
        type,
        title: item.lessonTitle || extracted.title || `Lesson ${lessonNumber}`,
        videoUrls: extracted.videoUrls,
        body: extracted.body,
        thinkificUrl: href,
        thinkificKind: extracted.kind,
      });
    } catch (error) {
      console.warn(`  skipped: ${(error as Error).message}`);
    }
  }

  const payload = {
    company: "Accounting Study Advice",
    className: COURSE_NAME,
    source: "thinkific",
    scrapedAt: new Date().toISOString(),
    startUrl: page.url(),
    chapters,
  };

  await writeFile(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Saved ${chapters.length} chapters to ${OUT_FILE}`);
  await context.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
