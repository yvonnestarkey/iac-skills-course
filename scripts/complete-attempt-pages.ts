import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { ensureCompleteAttemptPageImages, getAttemptAnalysisPages } from "@/lib/exam-analysis-pages";

function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();
  const attemptId = process.argv[2];
  if (!attemptId) {
    console.error("Usage: tsx scripts/complete-attempt-pages.ts <attempt-id>");
    process.exit(1);
  }
  const completed = await ensureCompleteAttemptPageImages(attemptId);
  if (completed.ok === false) {
    console.error(completed.error);
    process.exit(1);
  }
  const pages = await getAttemptAnalysisPages(attemptId);
  console.log(
    JSON.stringify(
      {
        analysed: false,
        rendered: completed.rendered,
        files: pages
          ? Object.fromEntries(
              Object.entries(pages.files).map(([kind, file]) => [
                kind,
                {
                  pdf_page_count: file.pdf_page_count,
                  image_count: file.image_count,
                  complete: file.complete,
                  missing_pages: file.missing_pages,
                },
              ])
            )
          : null,
        multimodal_input_count: pages?.multimodal_inputs.length ?? 0,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
