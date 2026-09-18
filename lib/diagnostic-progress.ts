import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchLatestBmcr, fetchLatestVolumeAccuracy } from "./volume-accuracy";
import { fetchLatestBuriedTreasure } from "./buried-treasure";
import { getSupabase } from "./supabase";

export type MarkReportUpload = {
  id?: string;
  user_id: string;
  paper_name: string;
  file_url: string;
  file_name: string;
  created_at?: string;
};

export type DiagnosticProgress = {
  hasBmcr: boolean;
  hasVolume: boolean;
  hasBuriedTreasure: boolean;
  hasMarkReport: boolean;
  markReport: MarkReportUpload | null;
  ready: boolean;
};

function rowToUpload(row: Record<string, unknown>): MarkReportUpload {
  return {
    id: row.id ? String(row.id) : undefined,
    user_id: String(row.user_id || ""),
    paper_name: String(row.paper_name || ""),
    file_url: String(row.file_url || ""),
    file_name: String(row.file_name || "mark-report.pdf"),
    created_at: row.created_at ? String(row.created_at) : undefined,
  };
}

export async function fetchLatestMarkReport(
  supabase: SupabaseClient,
  userId: string
): Promise<MarkReportUpload | null> {
  const { data, error } = await supabase
    .from("mark_report_uploads")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return rowToUpload(data as Record<string, unknown>);
}

export async function fetchDiagnosticProgress(
  supabase: SupabaseClient,
  userId: string
): Promise<DiagnosticProgress> {
  const [bmcr, volume, buriedTreasure, markReport] = await Promise.all([
    fetchLatestBmcr(supabase, userId).catch(() => null),
    fetchLatestVolumeAccuracy(supabase, userId).catch(() => null),
    fetchLatestBuriedTreasure(supabase, userId).catch(() => null),
    fetchLatestMarkReport(supabase, userId).catch(() => null),
  ]);
  const hasBmcr = Boolean(bmcr);
  const hasVolume = Boolean(volume);
  const hasBuriedTreasure = Boolean(buriedTreasure);
  const hasMarkReport = Boolean(markReport?.file_url);
  return {
    hasBmcr,
    hasVolume,
    hasBuriedTreasure,
    hasMarkReport,
    markReport,
    ready: hasBmcr && hasVolume && hasBuriedTreasure && hasMarkReport,
  };
}

export async function fetchOwnDiagnosticProgress(userId: string): Promise<DiagnosticProgress> {
  const supabase = getSupabase();
  if (!supabase || !userId) {
    return { hasBmcr: false, hasVolume: false, hasBuriedTreasure: false, hasMarkReport: false, markReport: null, ready: false };
  }
  return fetchDiagnosticProgress(supabase, userId);
}

export async function uploadMarkReport(
  userId: string,
  file: File,
  paperName = ""
): Promise<{ ok: true; upload: MarkReportUpload } | { ok: false; error: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  const name = file.name.toLowerCase();
  if (!file.type.includes("pdf") && !name.endsWith(".pdf")) {
    return { ok: false, error: "Please upload your mark report as a PDF." };
  }
  const originalName = file.name.trim() || "mark-report.pdf";
  const path = `survey-responses/mark-report/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
  const uploaded = await supabase.storage.from("course-pdfs").upload(path, file, {
    upsert: true,
    contentType: file.type || "application/pdf",
  });
  if (uploaded.error) {
    return { ok: false, error: "Could not upload that PDF. Paste supabase/mark_reports.sql if the table is missing." };
  }
  const { data } = supabase.storage.from("course-pdfs").getPublicUrl(path);
  if (!data?.publicUrl) return { ok: false, error: "Could not get a URL for that PDF." };
  const { data: row, error } = await supabase
    .from("mark_report_uploads")
    .insert({
      user_id: userId,
      paper_name: paperName,
      file_url: data.publicUrl,
      file_name: originalName,
    })
    .select("*")
    .single();
  if (error) {
    if (/mark_report_uploads|schema cache|does not exist/i.test(error.message)) {
      return { ok: false, error: "Could not save the upload. Paste supabase/mark_reports.sql in the SQL editor first." };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, upload: rowToUpload(row as Record<string, unknown>) };
}

export function formatMarkReportContext(upload: MarkReportUpload | null): string {
  if (!upload) return "Mark report upload: none yet.";
  return `Mark report uploaded (${upload.created_at || "undated"}): ${upload.file_name}${upload.paper_name ? ` · ${upload.paper_name}` : ""} (${upload.file_url})`;
}
