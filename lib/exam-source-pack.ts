import { getSupabaseAdmin } from "@/lib/knowledge-gateway-db";
import { findPastPaper } from "@/lib/past-papers";

export type OfficialSourceKind = "question" | "solution" | "commentary" | "competency";

export type OfficialSourceDocument = {
  kind: OfficialSourceKind;
  document_title: string;
  category: string;
  chunk_count: number;
  ids: string[];
  preview: string;
};

export type OfficialSourcePack = {
  sitting_id: string;
  paper_id: string;
  retrieval: "deterministic_title";
  complete: boolean;
  missing: OfficialSourceKind[];
  documents: OfficialSourceDocument[];
  notes: string[];
};

type PaperSourceSpec = {
  question: string[];
  solution: string[];
};

type SittingSourceSpec = {
  papers: Record<string, PaperSourceSpec>;
  commentary: string[];
};

/** Filenames as ingested into knowledge_base.document_title (hyphens kept; chunks append " (n)"). */
const SITTING_SPECS: Record<string, SittingSourceSpec> = {
  "jan-2026": {
    commentary: ["iac-january-2026-markers-and-umpires-comments", "iac january 2026 markers and umpires comments"],
    papers: {
      "jan-2026-p1": {
        question: ["iac-january-2026-paper-1-question-mzansi", "iac january 2026 paper 1 question mzansi"],
        solution: [
          "iac-january-2026-paper-1-part-i-solution-mzansi",
          "iac-january-2026-paper-1-part-ii-solution-mzansi",
          "iac january 2026 paper 1 part i solution mzansi",
          "iac january 2026 paper 1 part ii solution mzansi",
        ],
      },
      "jan-2026-p2": {
        question: ["iac-january-2026-paper-2-question-lexi", "iac january 2026 paper 2 question lexi"],
        solution: [
          "iac-january-2026-paper-2-part-i-solution-lexi",
          "iac-january-2026-paper-2-part-ii-solution-lexi",
        ],
      },
      "jan-2026-p3": {
        question: ["iac-january-2026-paper-3-question-ir", "iac january 2026 paper 3 question ir"],
        solution: [
          "iac-january-2026-paper-3-part-i-solution-ir",
          "iac-january-2026-paper-3-part-ii-solution-ir",
        ],
      },
    },
  },
  "jan-2025": {
    commentary: ["iac-january-2025-markers-and-umpires-comments", "iac january 2025 markers and umpires comments"],
    papers: {
      "jan-2025-p1": {
        question: ["iac-january-2025-paper-1-question-marchant"],
        solution: ["iac-january-2025-paper-1-solution-marchant"],
      },
      "jan-2025-p2": {
        question: ["iac-january-2025-paper-2-question-freschkart"],
        solution: ["iac-january-2025-paper-2-solution-freschkart"],
      },
      "jan-2025-p3": {
        question: ["iac-january-2025-paper-3-question-transt"],
        solution: ["iac-january-2025-paper-3-solution-transt"],
      },
    },
  },
};

export const COMPETENCY_DOCUMENT_STEMS = [
  "ca-of-the-future-academic-programme-guidance",
  "ca-of-the-future-appendix-1-detailed-competencies",
  "ca-of-the-future-entry-level-competency-framework",
  "iac-competency-map",
  "iac-competency-emphasis",
];

export function officialSourceSpec(sittingId: string, paperId: string): {
  question: string[];
  solution: string[];
  commentary: string[];
  competency: string[];
} | null {
  const sitting = SITTING_SPECS[sittingId];
  const paper = sitting?.papers[paperId];
  if (!sitting || !paper) return null;
  return {
    question: paper.question,
    solution: paper.solution,
    commentary: sitting.commentary,
    competency: COMPETENCY_DOCUMENT_STEMS,
  };
}

function normalizeTitle(value: string): string {
  return value.toLowerCase().replace(/[-–—_]+/g, " ").replace(/\s+/g, " ").trim();
}

function titleMatchesStem(title: string, stem: string): boolean {
  const hay = normalizeTitle(title);
  const needle = normalizeTitle(stem);
  return hay === needle || hay.startsWith(`${needle} (`) || hay.includes(needle);
}

function baseDocumentTitle(title: string): string {
  return title.replace(/\s+\(\d+\)\s*$/, "").trim();
}

async function fetchByStems(stems: string[]): Promise<{ id: string; document_title: string; category: string; content: string }[]> {
  const client = getSupabaseAdmin();
  if (!client || !stems.length) return [];
  const rows: { id: string; document_title: string; category: string; content: string }[] = [];
  const seen = new Set<string>();
  for (const stem of stems) {
    const hyphen = stem.replace(/\s+/g, "-");
    const spaced = stem.replace(/[-_]+/g, " ");
    for (const variant of [...new Set([stem, hyphen, spaced])]) {
      const { data, error } = await client
        .from("knowledge_base")
        .select("id, document_title, category, content")
        .ilike("document_title", `${variant}%`)
        .limit(400);
      if (error || !data) continue;
      for (const row of data as { id: string; document_title: string; category: string; content: string }[]) {
        if (!titleMatchesStem(row.document_title, stem) && !titleMatchesStem(row.document_title, variant)) continue;
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        rows.push(row);
      }
    }
  }
  return rows;
}

function groupDocuments(
  kind: OfficialSourceKind,
  rows: { id: string; document_title: string; category: string; content: string }[]
): OfficialSourceDocument[] {
  const grouped = new Map<string, OfficialSourceDocument>();
  for (const row of rows) {
    const title = baseDocumentTitle(row.document_title);
    const current = grouped.get(title) || {
      kind,
      document_title: title,
      category: row.category,
      chunk_count: 0,
      ids: [],
      preview: "",
    };
    current.chunk_count += 1;
    current.ids.push(row.id);
    if (!current.preview) current.preview = String(row.content || "").slice(0, 280);
    grouped.set(title, current);
  }
  return [...grouped.values()];
}

export async function loadOfficialSourcePack(sittingId: string, paperId: string): Promise<OfficialSourcePack> {
  const mapped = findPastPaper(paperId);
  const resolvedSitting = mapped?.sitting.id || sittingId;
  const resolvedPaper = mapped?.paper.id || paperId;
  const spec = officialSourceSpec(resolvedSitting, resolvedPaper);
  const notes: string[] = [
    "Primary retrieval is deterministic from the selected sitting and paper. Vector search does not choose the exam pack.",
  ];

  if (!spec) {
    return {
      sitting_id: resolvedSitting,
      paper_id: resolvedPaper,
      retrieval: "deterministic_title",
      complete: false,
      missing: ["question", "solution", "commentary", "competency"],
      documents: [],
      notes: [
        ...notes,
        "No official title map for this sitting/paper yet. First complete vertical slice is IAC January 2026.",
      ],
    };
  }

  const [questionRows, solutionRows, commentaryRows, competencyRows] = await Promise.all([
    fetchByStems(spec.question),
    fetchByStems(spec.solution),
    fetchByStems(spec.commentary),
    fetchByStems(spec.competency),
  ]);

  const documents = [
    ...groupDocuments("question", questionRows),
    ...groupDocuments("solution", solutionRows),
    ...groupDocuments("commentary", commentaryRows),
    ...groupDocuments("competency", competencyRows),
  ];

  const missing: OfficialSourceKind[] = [];
  if (!questionRows.length) missing.push("question");
  if (!solutionRows.length) missing.push("solution");
  if (!commentaryRows.length) missing.push("commentary");
  if (!competencyRows.length) missing.push("competency");

  if (resolvedSitting === "jan-2026") {
    notes.push("January 2026 uses the ingested question, part I/II solutions, sitting-level markers/umpires comments, and the five competency documents.");
  }

  return {
    sitting_id: resolvedSitting,
    paper_id: resolvedPaper,
    retrieval: "deterministic_title",
    complete: missing.length === 0,
    missing,
    documents,
    notes,
  };
}

export function summariseOfficialSourcePack(pack: OfficialSourcePack): Record<string, unknown> {
  return {
    sitting_id: pack.sitting_id,
    paper_id: pack.paper_id,
    retrieval: pack.retrieval,
    complete: pack.complete,
    missing: pack.missing,
    notes: pack.notes,
    documents: pack.documents.map((doc) => ({
      kind: doc.kind,
      document_title: doc.document_title,
      category: doc.category,
      chunk_count: doc.chunk_count,
      preview: doc.preview,
    })),
  };
}
