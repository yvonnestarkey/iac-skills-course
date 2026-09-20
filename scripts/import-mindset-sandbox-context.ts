/**
 * Extract Mindset Sandbox DOCX files to markdown and publish current rows.
 *
 * Preview only:
 *   npx tsx scripts/import-mindset-sandbox-context.ts --preview
 *
 * Import after supabase/mindset-sandbox-context.sql has been pasted:
 *   npx tsx scripts/import-mindset-sandbox-context.ts --import
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local for --import.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import mammoth from "mammoth";

const convertToMarkdown = (
  mammoth as typeof mammoth & {
    convertToMarkdown: (input: { path: string }) => Promise<{ value: string }>;
  }
).convertToMarkdown;

const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, "docs", "mindset-sandbox");

const DOCUMENTS = [
  {
    contextType: "project_canon",
    title: "Mindset Sandbox Project Brief",
    version: "2026-09-20",
    filename: "Mindset_Sandbox_Project_Brief_2026-09-20.docx",
  },
  {
    contextType: "working_state",
    title: "Mindset Sandbox Continuation",
    version: "2026-09-20",
    filename: "Mindset_Sandbox_Continuation_2026-09-20.docx",
  },
] as const;

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

async function extractMarkdown(filePath: string): Promise<string> {
  const result = await convertToMarkdown({ path: filePath });
  const text = result.value
    .replace(/\r\n/g, "\n")
    .replace(/\\([.\\`*_[\]()#+-])/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text) throw new Error(`No text extracted from ${path.basename(filePath)}`);
  return text;
}

function preview(text: string, limit = 1600): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trimEnd()}\n\n… [${text.length - limit} more characters]`;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const shouldImport = args.has("--import");
  const shouldPreview = args.has("--preview") || !shouldImport;
  loadEnvLocal();

  mkdirSync(DOCS_DIR, { recursive: true });
  const extracted: { contextType: string; filename: string; title: string; version: string; content: string }[] = [];

  for (const doc of DOCUMENTS) {
    const filePath = path.join(DOCS_DIR, doc.filename);
    if (!existsSync(filePath)) {
      throw new Error(`Missing ${filePath}. Copy the DOCX into docs/mindset-sandbox/ first.`);
    }
    const content = await extractMarkdown(filePath);
    writeFileSync(path.join(DOCS_DIR, doc.filename.replace(/\.docx$/i, ".md")), `${content}\n`);
    extracted.push({ ...doc, contextType: doc.contextType, content });
  }

  if (shouldPreview) {
    for (const doc of extracted) {
      console.log(`\n===== ${doc.filename} → ${doc.contextType} =====\n`);
      console.log(preview(doc.content));
    }
  }

  if (!shouldImport) return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.");

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  for (const doc of extracted) {
    const { error } = await supabase.rpc("replace_mindset_sandbox_context", {
      p_context_type: doc.contextType,
      p_title: doc.title,
      p_version: doc.version,
      p_content: doc.content,
      p_source_filename: doc.filename,
    });
    if (error) throw new Error(`Import failed for ${doc.contextType}: ${error.message}`);
    console.log(`Imported current ${doc.contextType} (${doc.content.length} chars).`);
  }

  const { data, error } = await supabase
    .from("mindset_sandbox_context")
    .select("context_type, title, version, status, source_filename, updated_at, content")
    .eq("status", "current")
    .in("context_type", ["project_canon", "working_state"]);
  if (error) throw new Error(`Read-back failed: ${error.message}`);
  console.log("\n===== Supabase read-back =====\n");
  console.log(JSON.stringify(
    (data || []).map((row) => ({
      context_type: row.context_type,
      title: row.title,
      version: row.version,
      status: row.status,
      source_filename: row.source_filename,
      updated_at: row.updated_at,
      content_chars: String(row.content || "").length,
      heading_sample: String(row.content || "").split("\n").find((line) => line.startsWith("# ")) || "",
    })),
    null,
    2
  ));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
