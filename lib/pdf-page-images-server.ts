import { createCanvas } from "@napi-rs/canvas";
import { PDF_PAGE_RENDER_LIMIT } from "@/lib/pdf-page-limit";

const SCALE = 1.45;

export type RenderedPdfPage = {
  page: number;
  bytes: Buffer;
  contentType: "image/jpeg";
};

class ServerCanvasFactory {
  create(width: number, height: number) {
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext("2d") };
  }
  reset(canvasAndContext: { canvas: { width: number; height: number } }, width: number, height: number) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }
  destroy(canvasAndContext: { canvas: { width: number; height: number } }) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
  }
}

function copyPdfBytes(buffer: ArrayBuffer): Uint8Array {
  return new Uint8Array(buffer.slice(0));
}

export async function countPdfPages(buffer: ArrayBuffer): Promise<number> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(copyPdfBytes(buffer));
  return Number(pdf.numPages || 0);
}

/** Server-side JPEG render for missing or never-rendered PDF pages. Does not analyse content. */
export async function renderPdfPageJpegs(
  buffer: ArrayBuffer,
  already: Set<number> = new Set()
): Promise<{ pageCount: number; pages: RenderedPdfPage[] }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: copyPdfBytes(buffer),
    CanvasFactory: ServerCanvasFactory,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;
  const pageCount = doc.numPages;
  const last = Math.min(pageCount, PDF_PAGE_RENDER_LIMIT);
  const pages: RenderedPdfPage[] = [];
  for (let pageNumber = 1; pageNumber <= last; pageNumber += 1) {
    if (already.has(pageNumber)) continue;
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: SCALE });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext("2d");
    await page.render({
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;
    pages.push({
      page: pageNumber,
      bytes: Buffer.from(await canvas.encode("jpeg", 72)),
      contentType: "image/jpeg",
    });
    canvas.width = 0;
    canvas.height = 0;
  }
  return { pageCount, pages };
}
