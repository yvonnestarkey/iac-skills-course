import path from "node:path";
import { chromium } from "playwright";

const PROFILE_DIR = path.join(process.cwd(), ".thinkific-chrome");
const URL =
  process.argv[2] ||
  "https://courses.accountingstudyadvice.com/courses/take/iac-skills-course-jan-2027/texts/78028904-l1-is-theory-costing-you-the-most-marks";

async function main() {
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    channel: "chrome",
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });
  await context.addInitScript("Object.defineProperty(navigator, 'webdriver', { get: () => undefined });");
  const page = context.pages()[0] || (await context.newPage());
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(8000);
  const info = await page.evaluate(`(() => {
    const iframes = Array.from(document.querySelectorAll("iframe")).map((f) => ({
      src: f.getAttribute("src") || "",
      id: f.id,
      className: f.className,
    }));
    const h = Array.from(document.querySelectorAll("h1,h2,h3")).map((el) => ({
      tag: el.tagName,
      className: el.className,
      text: (el.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 120),
    }));
    const contentRoots = [".fr-view", ".lecture-content", ".course-player__content", "[class*='LessonContent']", "article", "main"].map((sel) => {
      const el = document.querySelector(sel);
      return el ? { sel, text: (el.innerText || "").slice(0, 300), p: el.querySelectorAll("p").length } : { sel, missing: true };
    });
    const html = document.body.innerHTML;
    const wistia = [...html.matchAll(/wistia[^\s"'<>]{0,80}/gi)].slice(0, 20).map((m) => m[0]);
    const vimeo = [...html.matchAll(/vimeo[^\s"'<>]{0,80}/gi)].slice(0, 20).map((m) => m[0]);
    const current = document.querySelector("[aria-current='page'], .active a, a.active");
    return {
      title: document.title,
      h,
      iframes,
      contentRoots,
      wistia,
      vimeo,
      current: current ? (current.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 120) : "",
      bodyText: (document.body.innerText || "").slice(0, 2000),
    };
  })()`);
  console.log(JSON.stringify(info, null, 2));
  await context.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
