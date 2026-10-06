import Anthropic from "@anthropic-ai/sdk";
import type { ImageBlockParam, Tool } from "@anthropic-ai/sdk/resources/messages";
import type { UsageTally } from "./types";

export const DEFAULT_EVALUATOR_MODEL = "claude-sonnet-5-5";

export function evaluatorModel(): string {
  return process.env.EVALUATOR_MODEL?.trim() || DEFAULT_EVALUATOR_MODEL;
}

export function newUsage(): UsageTally {
  return { input_tokens: 0, output_tokens: 0, calls: 0 };
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set on the server.");
  if (!client) client = new Anthropic({ apiKey });
  return client;
}

export type PageImage = { page: number; mediaType: "image/jpeg" | "image/png" | "image/webp"; data: string };

function mediaType(value: string): PageImage["mediaType"] {
  const lower = value.toLowerCase();
  if (lower.includes("png")) return "image/png";
  if (lower.includes("webp")) return "image/webp";
  return "image/jpeg";
}

export async function fetchPageImages(pages: { page: number; url: string }[]): Promise<PageImage[]> {
  const out: PageImage[] = [];
  for (const item of pages) {
    const response = await fetch(item.url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not download page ${item.page} image (${response.status}).`);
    const bytes = Buffer.from(await response.arrayBuffer());
    out.push({ page: item.page, mediaType: mediaType(response.headers.get("content-type") || "image/jpeg"), data: bytes.toString("base64") });
  }
  return out;
}

export function imageBlocks(label: string, images: PageImage[]): (ImageBlockParam | { type: "text"; text: string })[] {
  const blocks: (ImageBlockParam | { type: "text"; text: string })[] = [];
  for (const image of images) {
    blocks.push({ type: "text", text: `${label} — page ${image.page}` });
    blocks.push({ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } });
  }
  return blocks;
}

/**
 * One structured call. The model must answer through a single forced tool so the output is JSON that
 * matches `schema`. Retries once on a transient failure.
 */
export async function callStructured<T>(input: {
  system: string;
  userContent: (ImageBlockParam | { type: "text"; text: string })[];
  toolName: string;
  toolDescription: string;
  schema: Tool["input_schema"];
  usage: UsageTally;
  maxTokens?: number;
}): Promise<T> {
  const anthropic = getClient();
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: evaluatorModel(),
        max_tokens: input.maxTokens ?? 8000,
        system: input.system,
        tools: [{ name: input.toolName, description: input.toolDescription, input_schema: input.schema }],
        tool_choice: { type: "tool", name: input.toolName },
        messages: [{ role: "user", content: input.userContent }],
      });
      input.usage.calls += 1;
      input.usage.input_tokens += response.usage.input_tokens;
      input.usage.output_tokens += response.usage.output_tokens;
      const block = response.content.find((item) => item.type === "tool_use");
      if (!block || block.type !== "tool_use") throw new Error("Model returned no structured result.");
      return block.input as T;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Structured call failed.");
}
