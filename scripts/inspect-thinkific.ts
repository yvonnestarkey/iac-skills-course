import { writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const PROFILE_DIR = path.join(process.cwd(), ".thinkific-chrome");
const URL =
  process.argv[2] ||
  "https://courses.accountingstudyadvice.com/courses/take/iac-skills-course-jan-2027/texts/78028899-course-dates-details";

async function main() {
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    channel: "chrome",
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });
  await context.addInitScript("Object.defineProperty(navigator, 'webdriver', { get: () => undefined });");
  const page = context.pages()[0] || (await context.newPage());
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(4000);

  const info = await page.evaluate(`(() => {
    const links = Array.from(document.querySelectorAll("a[href]")).map((a) => ({
      href: a.href,
      text: (a.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 100),
    }));
    const takeLinks = links.filter((l) => /\\/courses\\/take\\//i.test(l.href));
    const iframes = Array.from(document.querySelectorAll("iframe")).map((f) => f.src);
    const ids = {
      html: document.documentElement.innerHTML.slice(0, 20000),
    };
    return {
      url: location.href,
      title: document.title,
      linkCount: links.length,
      takeLinks: takeLinks.slice(0, 120),
      iframes,
      textSample: (document.body.innerText || "").slice(0, 1500),
      htmlHead: ids.html,
    };
  })()`) as {
    url: string;
    title: string;
    linkCount: number;
    takeLinks: { href: string; text: string }[];
    iframes: string[];
    textSample: string;
    htmlHead: string;
  };

  await writeFile(path.join(process.cwd(), ".thinkific-inspect.json"), JSON.stringify(info, null, 2));
  console.log("url", info.url);
  console.log("title", info.title);
  console.log("links", info.linkCount, "takeLinks", (info.takeLinks || []).length);
  console.log("iframes", info.iframes);
  console.log("textSample", (info.textSample || "").slice(0, 400));
  await context.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
