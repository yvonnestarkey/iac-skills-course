import { getSupabase } from "./supabase";

export interface HelpContent {
  key: string;
  title: string;
  description: string;
  video_url: string | null;
}

const FALLBACKS: Record<string, HelpContent> = {
  phone_number_info: {
    key: "phone_number_info",
    title: "Phone number",
    description:
      "Add your number with the country code (for example +27 82 123 4567). We use it if we need to reach you quickly about coaching or your exam plan. You can leave this blank.",
    video_url: null,
  },
  accountability_email_info: {
    key: "accountability_email_info",
    title: "Accountability email",
    description:
      "This is someone who will nudge you when you stall — a partner, parent, colleague, or friend. We can copy them on reminders. You can leave this blank.",
    video_url: null,
  },
  study_planner_header_info: {
    key: "study_planner_header_info",
    title: "Study planner",
    description:
      "Set your start date, weekly hours, and study slots. We date the rest of the course so you can see when you finish, then export those sessions to your calendar.",
    video_url: null,
  },
};

let cache: Map<string, HelpContent> | null = null;
let loading: Promise<Map<string, HelpContent>> | null = null;

async function loadHelpContent(): Promise<Map<string, HelpContent>> {
  if (cache) return cache;
  if (!loading) {
    loading = (async () => {
      const map = new Map<string, HelpContent>(Object.entries(FALLBACKS));
      const client = getSupabase();
      if (!client) {
        cache = map;
        return map;
      }
      const { data, error } = await client.from("help_content").select("key, title, description, video_url");
      if (error) {
        console.error(error.message);
      } else {
        (data || []).forEach((row) => {
          if (!row?.key) return;
          map.set(String(row.key), {
            key: String(row.key),
            title: String(row.title || ""),
            description: String(row.description || ""),
            video_url: typeof row.video_url === "string" && row.video_url.trim() ? row.video_url.trim() : null,
          });
        });
      }
      cache = map;
      return map;
    })();
  }
  return loading;
}

export async function fetchHelpContent(contentKey: string): Promise<HelpContent | null> {
  const map = await loadHelpContent();
  return map.get(contentKey) || null;
}
