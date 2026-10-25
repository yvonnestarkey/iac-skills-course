import { getSupabase } from "./supabase";

export const STUDY_PLANNER_VIDEO_URL = "https://player.vimeo.com/video/1239250910";
export const STUDY_PLANNER_VIDEO_LABEL = "How to use the Study Planner";

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
    video_url: STUDY_PLANNER_VIDEO_URL,
  },
  live_calendar_subscription: {
    key: "live_calendar_subscription",
    title: "Calendar subscription",
    description:
      "Subscribing adds all live calls directly to your Apple, Google, or Outlook calendar. Any schedule updates or room changes will sync automatically.",
    video_url: null,
  },
  referral_programme_info: {
    key: "referral_programme_info",
    title: "Referral programme",
    description:
      "Share your code with a colleague. They receive 5% off their selected payment option. After their qualifying payment, you earn 10% course credit on this same account. Referral and promotional codes cannot be combined.",
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
          const key = String(row.key);
          const fallback = FALLBACKS[key];
          const storedVideo = typeof row.video_url === "string" && row.video_url.trim() ? row.video_url.trim() : "";
          map.set(key, {
            key,
            title: String(row.title || fallback?.title || ""),
            description: String(row.description || fallback?.description || ""),
            video_url: storedVideo || fallback?.video_url || null,
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
