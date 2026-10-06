import { getSupabaseAdmin } from "@/lib/knowledge-gateway-db";
import { loadOfficialSourcePack, type OfficialSourceKind } from "@/lib/exam-source-pack";

export type SourceText = {
  kind: OfficialSourceKind;
  document_title: string;
  text: string;
};

export type LoadedSources = {
  documents: SourceText[];
  missing: OfficialSourceKind[];
  notes: string[];
};

function chunkIndex(title: string): number {
  const match = title.match(/\((\d+)\)\s*$/);
  return match ? Number(match[1]) : 0;
}

/** Competency documents are huge; include only the two course-specific ones in full. */
const FULL_TEXT_COMPETENCY = ["iac-competency-map", "iac-competency-emphasis"];
const MAX_CHARS_PER_DOC = 60000;

export async function loadSources(sittingId: string, paperId: string): Promise<LoadedSources> {
  const pack = await loadOfficialSourcePack(sittingId, paperId);
  const client = getSupabaseAdmin();
  const notes = [...pack.notes];
  if (!client) return { documents: [], missing: pack.missing, notes: [...notes, "Knowledge database is not configured."] };

  const documents: SourceText[] = [];
  for (const doc of pack.documents) {
    if (doc.kind === "competency" && !FULL_TEXT_COMPETENCY.some((stem) => doc.document_title.toLowerCase().includes(stem))) {
      notes.push(`Competency framework "${doc.document_title}" is available but not inlined (${doc.chunk_count} chunks).`);
      continue;
    }
    const { data, error } = await client.from("knowledge_base").select("document_title, content").in("id", doc.ids);
    if (error || !data) {
      notes.push(`Could not read "${doc.document_title}": ${error?.message || "no data"}.`);
      continue;
    }
    const ordered = (data as { document_title: string; content: string }[]).sort(
      (a, b) => chunkIndex(a.document_title) - chunkIndex(b.document_title)
    );
    const text = ordered.map((row) => row.content).join("\n").slice(0, MAX_CHARS_PER_DOC);
    documents.push({ kind: doc.kind, document_title: doc.document_title, text });
  }
  return { documents, missing: pack.missing, notes };
}

export function sourcesAsPromptText(sources: LoadedSources, kinds: OfficialSourceKind[]): string {
  return sources.documents
    .filter((doc) => kinds.includes(doc.kind))
    .map((doc) => `### [${doc.kind}] ${doc.document_title}\n${doc.text}`)
    .join("\n\n");
}
