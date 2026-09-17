/**
 * Embed files from knowledge_docs/ into public.knowledge_base.
 *
 * Paste supabase/knowledge_base.sql first. Then:
 *   npx tsx scripts/ingest-docs.ts
 *   npx tsx scripts/ingest-docs.ts iac-june-2026
 *
 * Optional argv tokens limit ingest to matching file paths.
 * Needs OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * Reads .txt, .md, and .pdf. A PDF is skipped when a .txt or .md with the same stem exists.
 * Re-running replaces previous rows for that document title. Category is the folder name
 * when it is competency_framework, examiner_report, or mark_plan.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { EMBEDDING_MODEL } from "../lib/knowledge";

const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, "knowledge_docs");
const CATEGORIES = new Set(["competency_framework", "examiner_report", "mark_plan"]);
const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;

function loadEnvLocal() {
  const file = path.join(ROOT, ".env.local");
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

function collectFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(full));
    else if (/\.(txt|md|pdf)$/i.test(entry.name) && !entry.name.startsWith(".")) out.push(full);
  }
  return out;
}

function listFiles(dir: string): string[] {
  const all = collectFiles(dir);
  const textStems = new Set(
    all.filter((file) => /\.(txt|md)$/i.test(file)).map((file) => file.replace(/\.(txt|md)$/i, ""))
  );
  return all.filter((file) => !/\.pdf$/i.test(file) || !textStems.has(file.replace(/\.pdf$/i, "")));
}

function categoryFor(file: string): string {
  const rel = path.relative(DOCS_DIR, file).split(path.sep);
  const folder = rel.length > 1 ? rel[0] : "";
  if (CATEGORIES.has(folder)) return folder;
  const name = path.basename(file).toLowerCase();
  if (name.includes("competenc")) return "competency_framework";
  if (name.includes("mark")) return "mark_plan";
  return "examiner_report";
}

function chunkText(text: string): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + CHUNK_SIZE, clean.length);
    if (end < clean.length) {
      const slice = clean.slice(start, end);
      const lastBreak = Math.max(slice.lastIndexOf("\n\n"), slice.lastIndexOf(". "));
      if (lastBreak > CHUNK_SIZE / 3) end = start + lastBreak + 1;
    }
    const chunk = clean.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= clean.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }
  return chunks;
}

async function readFileText(file: string): Promise<string> {
  if (file.toLowerCase().endsWith(".pdf")) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(readFileSync(file)));
    const extracted = await extractText(pdf, { mergePages: true });
    const text = Array.isArray(extracted.text) ? extracted.text.join("\n") : String(extracted.text || "");
    return text.trim();
  }
  return readFileSync(file, "utf8");
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!url || !serviceKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  if (!openaiKey) throw new Error("Missing OPENAI_API_KEY in .env.local");
  if (!existsSync(DOCS_DIR)) throw new Error(`Create ${DOCS_DIR} and add .txt, .md, or .pdf files.`);

  const filter = process.argv.slice(2);
  const files = listFiles(DOCS_DIR).filter(
    (file) => !filter.length || filter.some((token) => file.includes(token))
  );
  if (!files.length) throw new Error(`No .txt, .md, or .pdf files found in ${DOCS_DIR}`);

  const openai = new OpenAI({ apiKey: openaiKey });
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  let inserted = 0;
  for (const file of files) {
    const title = path.basename(file, path.extname(file)).replace(/[-_]+/g, " ");
    const category = categoryFor(file);
    const text = await readFileText(file);
    const chunks = chunkText(text);
    if (!chunks.length) throw new Error(`No text extracted from ${path.relative(ROOT, file)}`);
    const exactDelete = await supabase.from("knowledge_base").delete().eq("document_title", title);
    if (exactDelete.error) throw new Error(exactDelete.error.message);
    const chunkDelete = await supabase.from("knowledge_base").delete().like("document_title", `${title} (%`);
    if (chunkDelete.error) throw new Error(chunkDelete.error.message);
    console.log(`${path.relative(ROOT, file)} → ${chunks.length} chunk(s) [${category}]`);
    for (let i = 0; i < chunks.length; i += 16) {
      const batch = chunks.slice(i, i + 16);
      const embedding = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: batch });
      const rows = batch.map((content, index) => ({
        document_title: batch.length === 1 ? title : `${title} (${i + index + 1})`,
        category,
        content,
        embedding: embedding.data[index]?.embedding,
      }));
      const { error } = await supabase.from("knowledge_base").insert(rows);
      if (error) throw new Error(error.message);
      inserted += rows.length;
    }
  }
  console.log(`Inserted ${inserted} knowledge_base rows.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
