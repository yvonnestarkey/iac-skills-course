import { getServiceSupabase } from "@/lib/supabase-admin";
import { isCoachAccount } from "@/lib/roles";
import type { StudentUser } from "@/lib/student-lesson";

export const DEFAULT_PRODUCT_ID = "jan27-iac";

export type EntitlementStatus = "free_preview" | "full";
export type PurchaseOption = "once_off" | "plan_6";
export type RewardStatus = "pending" | "earned" | "applied" | "refund_due" | "refunded" | "reversed";

export type CourseProduct = {
  id: string;
  slug: string;
  title: string;
  currency: string;
  once_off_amount_cents: number;
  plan_amount_cents: number;
  plan_count: number;
  zar_once_off_caption: string;
  zar_plan_caption: string;
  referral_referee_bps: number;
  referral_referrer_bps: number;
  locked_lesson_message: string;
  buy_cta_label: string;
  referral_share_blurb: string;
  stripe_once_off_price_id: string | null;
  stripe_plan_price_id: string | null;
};

export const FALLBACK_PRODUCT: CourseProduct = {
  id: DEFAULT_PRODUCT_ID,
  slug: DEFAULT_PRODUCT_ID,
  title: "January 2027 IAC Skills Course",
  currency: "usd",
  once_off_amount_cents: 32700,
  plan_amount_cents: 6000,
  plan_count: 6,
  zar_once_off_caption: "approximately R5,400",
  zar_plan_caption: "approximately R980/month",
  referral_referee_bps: 500,
  referral_referrer_bps: 1000,
  locked_lesson_message: "This lesson is part of the full Jan 2027 IAC course.",
  buy_cta_label: "Buy full course",
  referral_share_blurb: "Your friend receives 5% off. You earn 10% course credit after their qualifying payment.",
  stripe_once_off_price_id: process.env.STRIPE_PRICE_ONCE_OFF || null,
  stripe_plan_price_id: process.env.STRIPE_PRICE_PLAN || null,
};

export const DEFAULT_PREVIEW_LESSON_IDS = [
  "ch3-l1",
  "ch3-l2",
  "ch3-l3",
  "ch3-l4",
  "ch3-l5",
  "ch3-l6",
  "ch3-l7",
  "ch3-l8",
  "ch4-l1",
  "ch5-l1",
  "ch10-l1",
  "ch12-l1",
  "ch13-l2",
  "ch15-l2",
  "ch16-l1",
  "ch18-l1",
] as const;

export function commerceTableMissing(message: string): boolean {
  return /course_products|course_entitlements|course_preview_lessons|referral_codes|schema cache|does not exist/i.test(message);
}

export function percentFromBps(bps: number): number {
  return bps / 100;
}

export function discountCents(amountCents: number, bps: number): number {
  return Math.round((amountCents * bps) / 10_000);
}

export function referrerCreditCents(option: PurchaseOption, product: CourseProduct): number {
  const base = option === "plan_6" ? product.plan_amount_cents * product.plan_count : product.once_off_amount_cents;
  return discountCents(base, product.referral_referrer_bps);
}

export function refereeDiscountCents(option: PurchaseOption, product: CourseProduct): number {
  const base = option === "plan_6" ? product.plan_amount_cents : product.once_off_amount_cents;
  return discountCents(base, product.referral_referee_bps);
}

export function canStackDiscounts(): boolean {
  return false;
}

export async function getCourseProduct(productId = DEFAULT_PRODUCT_ID): Promise<CourseProduct> {
  const client = getServiceSupabase();
  if (!client) return FALLBACK_PRODUCT;
  const { data, error } = await client.from("course_products").select("*").eq("id", productId).maybeSingle();
  if (error || !data) return FALLBACK_PRODUCT;
  return {
    ...FALLBACK_PRODUCT,
    ...data,
    stripe_once_off_price_id: data.stripe_once_off_price_id || FALLBACK_PRODUCT.stripe_once_off_price_id,
    stripe_plan_price_id: data.stripe_plan_price_id || FALLBACK_PRODUCT.stripe_plan_price_id,
  };
}

export async function listPreviewLessonIds(productId = DEFAULT_PRODUCT_ID): Promise<string[]> {
  const client = getServiceSupabase();
  if (!client) return [...DEFAULT_PREVIEW_LESSON_IDS];
  const { data, error } = await client
    .from("course_preview_lessons")
    .select("lesson_id")
    .eq("product_id", productId)
    .order("sort", { ascending: true });
  if (error || !data?.length) return [...DEFAULT_PREVIEW_LESSON_IDS];
  return data.map((row) => String(row.lesson_id));
}

export async function getEntitlement(userId: string, productId = DEFAULT_PRODUCT_ID): Promise<EntitlementStatus> {
  const client = getServiceSupabase();
  if (!client) return "full";
  const { data, error } = await client
    .from("course_entitlements")
    .select("status")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .maybeSingle();
  if (error) {
    if (commerceTableMissing(error.message)) return "full";
    return "free_preview";
  }
  return data?.status === "full" ? "full" : "free_preview";
}

export async function ensureCommerceAccount(user: StudentUser) {
  const client = getServiceSupabase();
  if (!client || isCoachAccount(user)) return;
  await client.from("course_entitlements").upsert(
    { user_id: user.id, product_id: DEFAULT_PRODUCT_ID, status: "free_preview", source: "signup", updated_at: new Date().toISOString() },
    { onConflict: "user_id,product_id", ignoreDuplicates: true }
  );
  const code = `JAN27-${user.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  await client.from("referral_codes").upsert({ user_id: user.id, code }, { onConflict: "user_id", ignoreDuplicates: true });
}

export async function grantFullEntitlement(userId: string, source: "stripe" | "admin") {
  const client = getServiceSupabase();
  if (!client) throw new Error("Supabase is not configured.");
  const { error } = await client.from("course_entitlements").upsert(
    {
      user_id: userId,
      product_id: DEFAULT_PRODUCT_ID,
      status: "full",
      source,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,product_id" }
  );
  if (error) throw new Error(error.message);
}

export type LessonContentAccess = {
  canReadBody: boolean;
  entitlement: EntitlementStatus | "staff" | "anonymous";
  preview: boolean;
};

export async function resolveLessonContentAccess(
  user: StudentUser | null,
  lessonId: string,
  options?: { overrideLocks?: boolean }
): Promise<LessonContentAccess> {
  if (user && (isCoachAccount(user) || options?.overrideLocks)) {
    return { canReadBody: true, entitlement: "staff", preview: true };
  }
  if (!user) return { canReadBody: false, entitlement: "anonymous", preview: false };
  const [entitlement, previewIds] = await Promise.all([getEntitlement(user.id), listPreviewLessonIds()]);
  if (entitlement === "full") return { canReadBody: true, entitlement, preview: previewIds.includes(lessonId) };
  return {
    canReadBody: previewIds.includes(lessonId),
    entitlement,
    preview: previewIds.includes(lessonId),
  };
}

export function stripProtectedLesson<T extends Record<string, unknown>>(row: T): T {
  return {
    ...row,
    body: [],
    takeaways: [],
    blurb: null,
    brief: null,
    video_urls: null,
    video_url: null,
    pdf_url: null,
    resource_downloads: null,
    banner_image_url: null,
  };
}
