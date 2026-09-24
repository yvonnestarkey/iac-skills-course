import { refereePerInstallmentCents, type CourseProduct } from "@/lib/commerce";

export const PLAN_OPTION = "plan_6" as const;

export type PlanInstallmentStatus = "pending" | "draft" | "paid" | "failed" | "void" | "canceled";

export type PlanInvoiceMetadata = {
  option: typeof PLAN_OPTION;
  purchase_id: string;
  product_id: string;
  user_id: string;
  installment: string;
  plan_count: string;
};

export type FuturePlanInvoiceDraft = {
  installment: number;
  amountCents: number;
  scheduledAt: Date;
  automaticallyFinalizesAt: number;
  collectionMethod: "charge_automatically";
  autoAdvance: true;
  description: string;
  metadata: PlanInvoiceMetadata;
};

export function unixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/** Last calendar day of the UTC month, at 12:00 UTC so the date is stable across timezones. */
export function calendarMonthEndUtc(year: number, monthIndex: number): Date {
  const overflowYear = year + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  return new Date(Date.UTC(overflowYear, month + 1, 0, 12, 0, 0));
}

/** Payment 1 is enrolment time; payments 2–6 are the next N-1 calendar month-ends. */
export function planInstallmentDates(enrolledAt: Date, planCount = 6): Date[] {
  const count = Math.max(1, planCount);
  const start = new Date(enrolledAt);
  const dates = [start];
  for (let offset = 1; offset < count; offset += 1) {
    dates.push(calendarMonthEndUtc(start.getUTCFullYear(), start.getUTCMonth() + offset));
  }
  return dates;
}

export function futurePlanInstallmentDates(enrolledAt: Date, planCount = 6): Date[] {
  return planInstallmentDates(enrolledAt, planCount).slice(1);
}

export function enrollmentCalendarMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function planInstallmentAmountCents(params: {
  product: CourseProduct;
  referralCode?: string | null;
  promoPercent?: number | null;
}): number {
  if (params.referralCode && params.promoPercent) {
    throw new Error("Referral and promotional discounts cannot be combined.");
  }
  const base = params.product.plan_amount_cents;
  if (params.referralCode) return base - refereePerInstallmentCents("plan_6", params.product);
  if (params.promoPercent) return base - Math.round((base * params.promoPercent) / 100);
  return base;
}

export function planInstallmentTotalCents(params: {
  product: CourseProduct;
  referralCode?: string | null;
  promoPercent?: number | null;
}): number {
  return planInstallmentAmountCents(params) * params.product.plan_count;
}

export function planInvoiceDescription(installment: number, planCount: number): string {
  return `January 2027 IAC Skills Course — instalment ${installment} of ${planCount}`;
}

export function planInvoiceMetadata(params: {
  purchaseId: string;
  productId: string;
  userId: string;
  installment: number;
  planCount: number;
}): PlanInvoiceMetadata {
  return {
    option: PLAN_OPTION,
    purchase_id: params.purchaseId,
    product_id: params.productId,
    user_id: params.userId,
    installment: String(params.installment),
    plan_count: String(params.planCount),
  };
}

export function futurePlanInvoiceDrafts(params: {
  enrolledAt: Date;
  purchaseId: string;
  productId: string;
  userId: string;
  amountCents: number;
  planCount?: number;
}): FuturePlanInvoiceDraft[] {
  const planCount = params.planCount ?? 6;
  const dates = planInstallmentDates(params.enrolledAt, planCount);
  return dates.slice(1).map((scheduledAt, index) => {
    const installment = index + 2;
    return {
      installment,
      amountCents: params.amountCents,
      scheduledAt,
      automaticallyFinalizesAt: unixSeconds(scheduledAt),
      collectionMethod: "charge_automatically" as const,
      autoAdvance: true as const,
      description: planInvoiceDescription(installment, planCount),
      metadata: planInvoiceMetadata({
        purchaseId: params.purchaseId,
        productId: params.productId,
        userId: params.userId,
        installment,
        planCount,
      }),
    };
  });
}

export function shouldCountPlanInstallmentInvoice(invoice: {
  id?: string | null;
  status?: string | null;
  amount_paid?: number | null;
  metadata?: Record<string, string> | null;
}): boolean {
  if (!invoice.id) return false;
  if (invoice.status && invoice.status !== "paid") return false;
  if (!Number(invoice.amount_paid)) return false;
  return isPlanInstallmentInvoice(invoice);
}

export function isPlanInstallmentInvoice(invoice: { metadata?: Record<string, string> | null }): boolean {
  const metadata = invoice.metadata || {};
  if (metadata.option !== PLAN_OPTION) return false;
  const number = Number(metadata.installment);
  return Number.isInteger(number) && number >= 1 && number <= 6;
}

export function installmentNumberFromInvoice(invoice: { metadata?: Record<string, string> | null }): number | null {
  const number = Number(invoice.metadata?.installment);
  return Number.isInteger(number) && number >= 1 && number <= 6 ? number : null;
}

export function voidActionForInvoiceStatus(status: string | null | undefined): "delete" | "void" | "skip" {
  if (status === "draft") return "delete";
  if (status === "open" || status === "uncollectible") return "void";
  return "skip";
}

export function planCheckoutPaymentParams(params: {
  customerId: string;
  installmentCents: number;
  planCount: number;
  metadata: Record<string, string>;
}) {
  return {
    mode: "payment" as const,
    customer: params.customerId,
    payment_intent_data: {
      setup_future_usage: "off_session" as const,
      metadata: params.metadata,
    },
    invoice_creation: {
      enabled: true,
      invoice_data: {
        description: planInvoiceDescription(1, params.planCount),
        metadata: {
          ...params.metadata,
          installment: "1",
          plan_count: String(params.planCount),
          option: PLAN_OPTION,
        },
      },
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: params.installmentCents,
          product_data: { name: planInvoiceDescription(1, params.planCount) },
        },
      },
    ],
  };
}
