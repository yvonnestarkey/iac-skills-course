"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { examSittingFromPastPaper, type ExamSitting } from "@/lib/exam-structure";
import {
  PAST_PAPER_SITTINGS,
  findPastPaperSitting,
  type PastPaperSitting,
} from "@/lib/past-papers";

export const EVALUATOR_EXAM_PARAM = "exam";
export const EVALUATOR_EXAM_STORAGE_KEY = "iac-evaluator-exam";

export function evaluatorHref(path: string, examId?: string | null): string {
  if (!examId) return path;
  const hashIndex = path.indexOf("#");
  const withoutHash = hashIndex === -1 ? path : path.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : path.slice(hashIndex);
  const [pathname, existing] = withoutHash.split("?");
  const params = new URLSearchParams(existing || "");
  params.set(EVALUATOR_EXAM_PARAM, examId);
  const query = params.toString();
  return `${pathname}?${query}${hash}`;
}

function storedExamId(): string {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(EVALUATOR_EXAM_STORAGE_KEY) || "";
}

function resolveExamId(candidate: string | null | undefined): string {
  const sitting = findPastPaperSitting(candidate);
  return sitting?.id || "";
}

export function useEvaluatorExam() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlExam = resolveExamId(searchParams.get(EVALUATOR_EXAM_PARAM));
  const [examId, setExamIdState] = useState(urlExam);
  const [ready, setReady] = useState(() => Boolean(urlExam));

  useEffect(() => {
    const fromStore = resolveExamId(storedExamId());
    const next = urlExam || fromStore;
    setExamIdState((prev) => (prev === next ? prev : next));
    if (urlExam) {
      window.sessionStorage.setItem(EVALUATOR_EXAM_STORAGE_KEY, urlExam);
    } else if (fromStore && pathname.startsWith("/student/")) {
      const params = new URLSearchParams(searchParams.toString());
      if (params.get(EVALUATOR_EXAM_PARAM) !== fromStore) {
        params.set(EVALUATOR_EXAM_PARAM, fromStore);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      }
    }
    setReady(true);
  }, [urlExam, pathname, router, searchParams]);

  const setExamId = useCallback(
    (nextId: string) => {
      const resolved = resolveExamId(nextId);
      setExamIdState(resolved);
      if (resolved) window.sessionStorage.setItem(EVALUATOR_EXAM_STORAGE_KEY, resolved);
      else window.sessionStorage.removeItem(EVALUATOR_EXAM_STORAGE_KEY);
      const params = new URLSearchParams(searchParams.toString());
      if (resolved) params.set(EVALUATOR_EXAM_PARAM, resolved);
      else params.delete(EVALUATOR_EXAM_PARAM);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const sitting = useMemo<PastPaperSitting | null>(
    () => findPastPaperSitting(examId) || null,
    [examId]
  );
  const exam = useMemo<ExamSitting | null>(
    () => (sitting ? examSittingFromPastPaper(sitting) : null),
    [sitting]
  );

  const href = useCallback((path: string) => evaluatorHref(path, examId), [examId]);

  return {
    examId,
    exam,
    sitting,
    setExamId,
    href,
    ready,
    sittings: PAST_PAPER_SITTINGS,
  };
}
