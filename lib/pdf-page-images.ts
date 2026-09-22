"use client";

import { PDF_PAGE_RENDER_LIMIT } from "@/lib/pdf-page-limit";

const SCALE = 1.45;

/**
 * Render PDF pages to JPEG images in the browser so the analysis pipeline
 * can inspect handwriting, workings, and layout — not OCR text alone.
 */
export async function renderPdfPageImages(file: File): Promise<{ page: number; blob: Blob }[]> {
  if (typeof window === "undefined") return [];
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const count = Math.min(doc.numPages, PDF_PAGE_RENDER_LIMIT);
  const pages: { page: number; blob: Blob }[] = [];
  for (let pageNumber = 1; pageNumber <= count; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) continue;
    await page.render({ canvasContext: context, viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.72));
    if (blob) pages.push({ page: pageNumber, blob });
  }
  return pages;
}
