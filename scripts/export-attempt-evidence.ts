/**
 * Export everything the evaluator would see for one attempt into a folder — NO AI calls, no token cost.
 * Use it to calibrate methodology in a chat (e.g. with Claude in your Obsidian vault) before spending API tokens.
 *
 *   npm run export:attempt -- --attempt=<uuid> --out="/path/to/vault/calibration"
 *
 * Writes <out>/<attempt>/{manifest.json, sources/*.md, script/p001.jpg…, report/p001.jpg…, bmcr/p001.jpg…}
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { examAttemptFromRow } from "../lib/exam-attempts";
import { findPastPaper } from "../lib/past-papers";
import { getServiceSupabase } from "../lib/supabase-admin";
import { loadSources } from "../lib/evaluator/sources";
import { requirementLabel } from "../lib/evaluator/pagemap";

function arg(name: string): string | undefined {
  const hit = process.argv.find((item) => item.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    if (!process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

async function download(url: string, file: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
  writeFileSync(file, Buffer.from(await response.arrayBuffer()));
}

async function main() {
  loadEnvLocal();
  const attemptId = arg("attempt");
  const outRoot = arg("out");
  if (!attemptId || !outRoot) throw new Error('Pass --attempt=<uuid> --out="/path/to/folder"');

  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  const { data, error } = await supabase.from("exam_attempts").select("*").eq("id", attemptId).limit(1).maybeSingle();
  if (error || !data) throw new Error(error?.message || "Attempt not found.");
  const attempt = examAttemptFromRow(data as { [key: string]: unknown });
  const mapped = findPastPaper(attempt.paper_id);
  if (!mapped) throw new Error(`Paper ${attempt.paper_id} not in registry.`);

  const root = path.join(outRoot, attemptId);
  for (const dir of ["sources", "script", "report", "bmcr"]) mkdirSync(path.join(root, dir), { recursive: true });

  const groups = [
    ["script", attempt.page_images.marked_script || []],
    ["report", attempt.page_images.marking_report || []],
    ["bmcr", attempt.page_images.bmcr_worksheet || []],
  ] as const;
  const counts: Record<string, number> = {};
  for (const [name, pages] of groups) {
    counts[name] = pages.length;
    for (const page of pages) await download(page.url, path.join(root, name, `p${String(page.page).padStart(3, "0")}.jpg`));
    console.log(`${name}: ${pages.length} pages`);
  }

  const sources = await loadSources(attempt.sitting_id, attempt.paper_id);
  for (const doc of sources.documents) {
    const safe = doc.document_title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    writeFileSync(path.join(root, "sources", `${doc.kind}--${safe}.md`), `# ${doc.document_title}\n\n${doc.text}\n`);
  }

  writeFileSync(
    path.join(root, "manifest.json"),
    JSON.stringify(
      {
        attempt_id: attempt.id,
        sitting: attempt.sitting_label,
        paper: attempt.paper_title,
        page_counts: counts,
        requirements: mapped.paper.questions.map((q) => ({ code: q.code, label: requirementLabel(q.code), title: q.title, marks: q.marks })),
        official_sources_missing: sources.missing,
        notes: sources.notes,
      },
      null,
      2
    )
  );
  console.log(`Exported to ${root}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
