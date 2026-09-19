/**
 * Second pass: reopen each lesson in iac-skills-course.json, wait for
 * Vimeo/Wistia iframes and .fr-view body text, then write the file back.
 *
 *   npx tsx scripts/enrich-thinkific.ts
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "playwright";

const OUT_FILE = path.join(process.cwd(), "iac-skills-course.json");
const PROFILE_DIR = path.join(process.cwd(), ".thinkific-chrome");

interface ScrapedLesson {
  id: string;
  type: string;
  title: string;
  videoUrls: string[];
  body: string[];
  thinkificUrl: string;
  thinkificKind?: string;
  chapterTitle?: string;
}

interface ScrapedChapter {
  id: string;
  title: string;
  summary: string;
  lessons: ScrapedLesson[];
}

interface CourseFile {
  company: string;
  className: string;
  source: string;
  scrapedAt: string;
  startUrl: string;
  chapters: ScrapedChapter[];
}

function typeFrom(href: string, videoUrls: string[], kind: string): ScrapedLesson["type"] {
  if (videoUrls.length) return "video";
  const pathName = href.toLowerCase();
  const blob = `${kind} ${pathName}`;
  if (pathName.includes("/assignments/") || blob.includes("assignment")) return "assignment";
  if (pathName.includes("/surveys/") || pathName.includes("/quizzes/") || blob.includes("survey") || blob.includes("quiz")) {
    return "survey";
  }
  if (blob.includes("pdf") || blob.includes("download") || blob.includes("upload")) return "upload";
  if (blob.includes("video")) return "video";
  return "reading";
}

async function waitForLesson(page: Page): Promise<void> {
  await page.waitForSelector('h3[class*="content-header__title"]', { timeout: 25000 });
  await Promise.race([
    page.waitForSelector(
      'iframe[src*="vimeo.com"], iframe[src*="wistia"], iframe[src*="youtube"], iframe[src*="youtu.be"]',
      { timeout: 12000 }
    ),
    page.waitForSelector(".fr-view p", { timeout: 12000 }),
    page.waitForTimeout(10000),
  ]).catch(() => {});
  await page.waitForTimeout(1500);
}

async function extract(page: Page): Promise<{
  title: string;
  chapterTitle: string;
  body: string[];
  videoUrls: string[];
  kind: string;
}> {
  return page.evaluate(`(() => {
    const titleEl = document.querySelector("h3[class*='content-header__title']");
    const title = (titleEl && titleEl.innerText && titleEl.innerText.replace(/\\s+/g, " ").trim()) || "";

    const here = location.href.split("#")[0];
    let chapterTitle = "Untitled chapter";
    const nodes = Array.from(document.querySelectorAll("h2[class*='chapter-item__title'], a[href*='/courses/take/']"));
    for (const node of nodes) {
      if (node.tagName === "H2") {
        const text = (node.innerText || "").replace(/\\s+/g, " ").trim();
        if (text) chapterTitle = text;
      } else if ((node.href || "").split("#")[0] === here) {
        break;
      }
    }

    const html = document.documentElement.innerHTML;
    const fromIframes = Array.from(document.querySelectorAll("iframe[src]"))
      .map((el) => el.getAttribute("src") || "")
      .filter((src) => /vimeo|wistia|youtube|youtu\\.be/i.test(src));
    const vimeoIds = Array.from(html.matchAll(/player\\.vimeo\\.com\\/video\\/(\\d+)/g)).map(
      (m) => "https://player.vimeo.com/video/" + m[1]
    );
    const wistiaIds = Array.from(html.matchAll(/fast\\.wistia\\.net\\/embed\\/iframe\\/([a-z0-9]+)/gi)).map(
      (m) => "https://fast.wistia.net/embed/iframe/" + m[1]
    );
    const videoUrls = [...new Set([...fromIframes, ...vimeoIds, ...wistiaIds])];

    const root = document.querySelector(".fr-view") || document.querySelector("main");
    const body = root
      ? Array.from(root.querySelectorAll("p, li"))
          .map((node) => (node.innerText || "").replace(/\\s+/g, " ").trim())
          .filter((text) => text.length > 25)
          .filter((text, index, list) => list.indexOf(text) === index)
          .slice(0, 60)
      : [];

    const kindEl = document.querySelector("[aria-current='page']");
    const kind = (kindEl && kindEl.textContent && kindEl.textContent.replace(/\\s+/g, " ").trim()) || "";

    return { title, chapterTitle, body, videoUrls, kind };
  })()`) as Promise<{
    title: string;
    chapterTitle: string;
    body: string[];
    videoUrls: string[];
    kind: string;
  }>;
}

function regroup(lessons: ScrapedLesson[]): ScrapedChapter[] {
  const chapters: ScrapedChapter[] = [];
  const index = new Map<string, ScrapedChapter>();
  for (const lesson of lessons) {
    const name = lesson.chapterTitle || "Untitled chapter";
    let chapter = index.get(name);
    if (!chapter) {
      chapter = { id: `ch${chapters.length + 1}`, title: name, summary: "", lessons: [] };
      index.set(name, chapter);
      chapters.push(chapter);
    }
    const lessonNumber = chapter.lessons.length + 1;
    chapter.lessons.push({
      ...lesson,
      id: `${chapter.id}-l${lessonNumber}`,
    });
  }
  return chapters;
}

async function save(data: CourseFile, lessons: ScrapedLesson[]) {
  data.chapters = regroup(lessons);
  data.scrapedAt = new Date().toISOString();
  await writeFile(OUT_FILE, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function main() {
  const data = JSON.parse(await readFile(OUT_FILE, "utf8")) as CourseFile;
  const lessons = data.chapters.flatMap((chapter) => chapter.lessons);
  console.log(`Second pass over ${lessons.length} lessons…`);

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    channel: "chrome",
    slowMo: 20,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });
  await context.addInitScript("Object.defineProperty(navigator, 'webdriver', { get: () => undefined });");
  const page = context.pages()[0] || (await context.newPage());

  for (let i = 0; i < lessons.length; i += 1) {
    const lesson = lessons[i];
    const url = lesson.thinkificUrl;
    if (!url) continue;
    console.log(`[${i + 1}/${lessons.length}] ${url}`);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await waitForLesson(page);
      const extracted = await extract(page);
      lesson.title = extracted.title || lesson.title;
      lesson.chapterTitle = extracted.chapterTitle;
      lesson.body = extracted.body;
      lesson.videoUrls = extracted.videoUrls;
      lesson.thinkificKind = extracted.kind || lesson.thinkificKind;
      lesson.type = typeFrom(url, extracted.videoUrls, extracted.kind);
      console.log(
        `    ${lesson.chapterTitle} · ${lesson.title} · ${lesson.type} · ${lesson.videoUrls.length} video · ${lesson.body.length} paras`
      );
    } catch (error) {
      console.warn(`    skipped: ${(error as Error).message}`);
    }
    if ((i + 1) % 5 === 0 || i === lessons.length - 1) await save(data, lessons);
  }

  await save(data, lessons);
  console.log(`Saved ${data.chapters.length} chapters to ${OUT_FILE}`);
  await context.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
