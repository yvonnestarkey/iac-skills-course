import { NextRequest, NextResponse } from "next/server";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import { postFromRow } from "@/lib/dashboard-posts";
import { getEntitlementRecord } from "@/lib/commerce";
import { courseAccessFromEntitlementStatus } from "@/lib/course-access";
import { portalToday } from "@/lib/student-task-due-dates";
import { getClassroomSubjectUser, readViewAsStudentId } from "@/lib/view-as-student-server";
import { getServiceSupabase } from "@/lib/supabase-admin";
import {
  commitmentFollowThrough,
  followThroughLabel,
  loadStudentPopupContext,
  pickMatchingPopup,
  popupError,
  popupHasContent,
  visiblePopupItems,
  type PopupDismissal,
  type PopupFollowThrough,
  type PopupResponse,
} from "@/lib/student-popups";
import { asProfileText } from "@/lib/account-profile";

export const dynamic = "force-dynamic";

function asDismissal(row: Record<string, unknown>): PopupDismissal {
  return {
    popupId: String(row.popup_id),
    mode: row.mode === "forever" ? "forever" : "today",
    onDate: String(row.on_date || "").slice(0, 10),
  };
}

function asResponse(row: Record<string, unknown>): PopupResponse {
  return {
    itemId: String(row.item_id),
    kind: row.kind === "answer" ? "answer" : "commitment",
    accepted: row.accepted === true,
    answer: asProfileText(row.answer),
    updatedAt: String(row.updated_at || row.created_at || ""),
  };
}

async function viewingAsOtherStudent(): Promise<boolean> {
  const actor = await getRequestUser();
  if (!isStaffUser(actor)) return false;
  const viewed = await readViewAsStudentId();
  return Boolean(viewed && viewed !== actor?.id);
}

export async function GET(request: NextRequest) {
  const actor = await getRequestUser();
  if (!actor) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const subject = await getClassroomSubjectUser(actor);
  if (!subject) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const history = request.nextUrl.searchParams.get("history") === "1";
  const studentId = isStaffUser(actor)
    ? asProfileText(request.nextUrl.searchParams.get("student_id")) || subject.id
    : subject.id;
  if (!isStaffUser(actor) && studentId !== actor.id && studentId !== subject.id) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const client = getServiceSupabase();
  if (!client) return NextResponse.json({ error: "Supabase is not configured." }, { status: 400 });

  const [postsQuery, entitlement, progress] = await Promise.all([
    client.from("dashboard_posts").select("*").eq("kind", "slide").order("published_at", { ascending: false }),
    getEntitlementRecord(studentId),
    client.from("lesson_progress").select("lesson_id, completed, video_percent").eq("user_id", studentId),
  ]);
  const completed = ((progress.data || []) as { lesson_id?: string; completed?: boolean; video_percent?: number }[])
    .filter((row) => Boolean(row.completed) || Number(row.video_percent || 0) >= 80)
    .map((row) => String(row.lesson_id || ""))
    .filter(Boolean);
  const listed = {
    posts: ((postsQuery.data || []) as Record<string, unknown>[]).map(postFromRow),
    error: postsQuery.error ? popupError(postsQuery.error.message) : "",
  };
  const ctx = await loadStudentPopupContext(
    studentId,
    completed,
    courseAccessFromEntitlementStatus(entitlement.status)
  );

  const { data: responseRows, error: responseError } = await client
    .from("student_popup_responses")
    .select("*")
    .eq("student_id", studentId)
    .order("updated_at", { ascending: false });
  if (responseError) return NextResponse.json({ error: popupError(responseError.message) }, { status: 400 });
  const responses = ((responseRows || []) as Record<string, unknown>[]).map(asResponse);

  if (history) {
    const byPopup = new Map((listed.posts || []).map((post) => [post.id, post]));
    const entries = ((responseRows || []) as Record<string, unknown>[]).map((row) => {
      const post = byPopup.get(String(row.popup_id));
      const item = (post?.items || []).find((entry) => entry.id === String(row.item_id));
      const response = asResponse(row);
      let followThrough: PopupFollowThrough | null = null;
      if (item?.kind === "commitment") {
        followThrough = commitmentFollowThrough(item, ctx, response.accepted);
      }
      return {
        popupId: String(row.popup_id),
        popupTitle: post?.title || "Login pop-up",
        itemId: response.itemId,
        kind: response.kind,
        label: item?.label || (response.kind === "answer" ? "Answer" : "Commitment"),
        accepted: response.accepted,
        answer: response.answer,
        deadline: item && item.kind === "commitment" ? item.deadline || "" : "",
        followThrough,
        followThroughLabel: followThroughLabel(followThrough),
        updatedAt: response.updatedAt,
      };
    });
    return NextResponse.json({ entries, hint: listed.error });
  }

  const { data: dismissalRows, error: dismissalError } = await client
    .from("student_popup_dismissals")
    .select("*")
    .eq("student_id", studentId);
  if (dismissalError) return NextResponse.json({ error: popupError(dismissalError.message) }, { status: 400 });
  const dismissals = ((dismissalRows || []) as Record<string, unknown>[]).map(asDismissal);
  const published = (listed.posts || []).filter((post) => post.status === "published");
  const match = pickMatchingPopup(published, ctx, dismissals);
  if (!match) return NextResponse.json({ popup: null });

  const popupResponses = responses.filter((row) =>
    match.items.some((item) => item.id === row.itemId)
  );
  const items = visiblePopupItems(match.items, ctx, popupResponses);
  if (!popupHasContent(match.title, match.body, match.videoUrl, items)) {
    return NextResponse.json({ popup: null });
  }
  return NextResponse.json({
    popup: match,
    items,
    responses: popupResponses,
    readOnly: await viewingAsOtherStudent(),
  });
}

export async function POST(request: Request) {
  const actor = await getRequestUser();
  if (!actor) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (await viewingAsOtherStudent()) {
    return NextResponse.json({ error: "Preview is read-only." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    action?: string;
    popup_id?: string;
    item_id?: string;
    mode?: string;
    accepted?: boolean;
    answer?: string;
  } | null;
  const popupId = asProfileText(body?.popup_id);
  if (!popupId) return NextResponse.json({ error: "Pop-up required." }, { status: 400 });

  const client = getServiceSupabase();
  if (!client) return NextResponse.json({ error: "Supabase is not configured." }, { status: 400 });
  const now = new Date().toISOString();
  const today = portalToday();

  if (body?.action === "dismiss") {
    const mode = body.mode === "forever" ? "forever" : "today";
    const { error } = await client.from("student_popup_dismissals").upsert(
      { popup_id: popupId, student_id: actor.id, mode, on_date: today, created_at: now },
      { onConflict: "popup_id,student_id" }
    );
    if (error) return NextResponse.json({ error: popupError(error.message) }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const itemId = asProfileText(body?.item_id);
  if (!itemId) return NextResponse.json({ error: "That item is missing." }, { status: 400 });

  if (body?.action === "commit") {
    const { error } = await client.from("student_popup_responses").upsert(
      {
        popup_id: popupId,
        student_id: actor.id,
        item_id: itemId,
        kind: "commitment",
        accepted: body.accepted !== false,
        answer: null,
        updated_at: now,
      },
      { onConflict: "popup_id,student_id,item_id" }
    );
    if (error) return NextResponse.json({ error: popupError(error.message) }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (body?.action === "answer") {
    const answer = asProfileText(body.answer);
    if (!answer) return NextResponse.json({ error: "Write an answer first." }, { status: 400 });
    const { error } = await client.from("student_popup_responses").upsert(
      {
        popup_id: popupId,
        student_id: actor.id,
        item_id: itemId,
        kind: "answer",
        accepted: null,
        answer,
        updated_at: now,
      },
      { onConflict: "popup_id,student_id,item_id" }
    );
    if (error) return NextResponse.json({ error: popupError(error.message) }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
