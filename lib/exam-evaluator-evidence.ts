import { findPastPaper } from "@/lib/past-papers";
import { examAttemptFromRow, type ExamAttempt, type ExamAttemptFileKind } from "@/lib/exam-attempts";
import {
  loadOfficialSourcePack,
  summariseOfficialSourcePack,
  type OfficialSourceKind,
} from "@/lib/exam-source-pack";
import { getServiceSupabase } from "@/lib/supabase-admin";

export const EVALUATOR_EVIDENCE_GROUPS = ["bmcr", "exam_script", "marking_report"] as const;
export type EvaluatorEvidenceGroup = (typeof EVALUATOR_EVIDENCE_GROUPS)[number];

const GROUP_TO_STORED: { [key in EvaluatorEvidenceGroup]: ExamAttemptFileKind } = {
  bmcr: "bmcr_worksheet",
  exam_script: "marked_script",
  marking_report: "marking_report",
};

export type EvaluatorPageImage = {
  page: number;
  image_url: string;
};

export type EvaluatorEvidenceFile = {
  group: EvaluatorEvidenceGroup;
  stored_kind: ExamAttemptFileKind;
  name: string | null;
  page_count: number;
  page_numbers: number[];
  pages: EvaluatorPageImage[];
};

export type EvaluatorRequirement = {
  code: string;
  title: string;
  total_marks: number;
};

export type EvaluatorOfficialDocument = {
  kind: OfficialSourceKind;
  document_title: string;
  chunk_count: number;
};

export type EvaluatorAttemptEvidence = {
  analysed: false;
  attempt: {
    id: string;
    user_id: string;
    exam_body: string;
    sitting_id: string;
    sitting_label: string;
    paper_id: string;
    paper_title: string;
    paper_code: string;
    status: string;
  };
  paper: {
    paper_id: string;
    paper_title: string;
    paper_code: string;
    total_marks: number;
    requirements: EvaluatorRequirement[];
  } | null;
  official_sources: {
    retrieval: "deterministic_title";
    complete: boolean;
    missing: OfficialSourceKind[];
    documents: EvaluatorOfficialDocument[];
  };
  evidence: { [key in EvaluatorEvidenceGroup]: EvaluatorEvidenceFile };
};

function pagesForGroup(attempt: ExamAttempt, group: EvaluatorEvidenceGroup): EvaluatorEvidenceFile {
  const storedKind = GROUP_TO_STORED[group];
  const stored = [...(attempt.page_images[storedKind] || [])]
    .filter((item) => Number.isFinite(item.page) && item.url)
    .sort((left, right) => left.page - right.page);
  const pages = stored.map((item) => ({ page: item.page, image_url: item.url }));
  return {
    group,
    stored_kind: storedKind,
    name: attempt[`${storedKind}_name`],
    page_count: pages.length,
    page_numbers: pages.map((item) => item.page),
    pages,
  };
}

function paperMetadata(attempt: ExamAttempt): EvaluatorAttemptEvidence["paper"] {
  const mapped = findPastPaper(attempt.paper_id);
  if (!mapped) {
    return {
      paper_id: attempt.paper_id,
      paper_title: attempt.paper_title,
      paper_code: attempt.paper_code,
      total_marks: 0,
      requirements: [],
    };
  }
  return {
    paper_id: mapped.paper.id,
    paper_title: mapped.paper.title,
    paper_code: mapped.paper.code,
    total_marks: mapped.paper.total_marks,
    requirements: mapped.paper.questions.map((question) => ({
      code: question.code,
      title: question.title,
      total_marks: question.marks,
    })),
  };
}

/** Shape stored attempt images and paper metadata for the evaluator. Does not analyse. */
export function bundleEvaluatorEvidence(
  attempt: ExamAttempt,
  official?: {
    retrieval: "deterministic_title";
    complete: boolean;
    missing: OfficialSourceKind[];
    documents: { kind: OfficialSourceKind; document_title: string; chunk_count: number }[];
  }
): EvaluatorAttemptEvidence {
  return {
    analysed: false,
    attempt: {
      id: attempt.id,
      user_id: attempt.user_id,
      exam_body: attempt.exam_body,
      sitting_id: attempt.sitting_id,
      sitting_label: attempt.sitting_label,
      paper_id: attempt.paper_id,
      paper_title: attempt.paper_title,
      paper_code: attempt.paper_code,
      status: attempt.status,
    },
    paper: paperMetadata(attempt),
    official_sources: official || {
      retrieval: "deterministic_title",
      complete: false,
      missing: ["question", "solution", "commentary", "competency"],
      documents: [],
    },
    evidence: {
      bmcr: pagesForGroup(attempt, "bmcr"),
      exam_script: pagesForGroup(attempt, "exam_script"),
      marking_report: pagesForGroup(attempt, "marking_report"),
    },
  };
}

export async function getEvaluatorAttemptEvidence(attemptId: string): Promise<EvaluatorAttemptEvidence | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.from("exam_attempts").select("*").eq("id", attemptId).limit(1).maybeSingle();
  if (error || !data) return null;
  const attempt = examAttemptFromRow(data as { [key: string]: unknown });
  const pack = await loadOfficialSourcePack(attempt.sitting_id, attempt.paper_id);
  const summarised = summariseOfficialSourcePack(pack);
  return bundleEvaluatorEvidence(attempt, {
    retrieval: "deterministic_title",
    complete: Boolean(summarised.complete),
    missing: (summarised.missing as OfficialSourceKind[]) || [],
    documents: ((summarised.documents as { kind: OfficialSourceKind; document_title: string; chunk_count: number }[]) || []).map(
      (doc) => ({
        kind: doc.kind,
        document_title: doc.document_title,
        chunk_count: doc.chunk_count,
      })
    ),
  });
}
