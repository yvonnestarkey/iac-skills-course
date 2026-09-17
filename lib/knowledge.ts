import OpenAI from "openai";
import { getServiceSupabase } from "./supabase-admin";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EVALUATION_MODEL = process.env.OPENAI_EVALUATION_MODEL || "gpt-4o-mini";

export type KnowledgeMatch = {
  id: string;
  document_title: string;
  category: string;
  content: string;
  similarity: number;
};

export function getOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

export async function embedText(input: string): Promise<number[]> {
  const client = getOpenAI();
  if (!client) throw new Error("OPENAI_API_KEY is not set.");
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: input.slice(0, 8000),
  });
  const vector = response.data[0]?.embedding;
  if (!vector?.length) throw new Error("OpenAI did not return an embedding.");
  return vector;
}

export async function matchKnowledgeBase(query: string, matchCount = 5): Promise<KnowledgeMatch[]> {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  const embedding = await embedText(query);
  const { data, error } = await supabase.rpc("match_knowledge_base", {
    query_embedding: embedding,
    match_count: matchCount,
  });
  if (error) throw new Error(error.message);
  return (data || []) as KnowledgeMatch[];
}
