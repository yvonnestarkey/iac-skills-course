import { isoToSastDateAndTime } from "@/lib/dates";
import { planInstallmentDates } from "@/lib/plan-installments";

export const REVENUE_SORTS = [
  "month",
  "paying_students",
  "sales_cents",
  "installments_paid_cents",
  "installments_due_cents",
  "referrals_paid_cents",
  "referrals_due_cents",
  "cash_cents",
] as const;

export type RevenueSortKey = (typeof REVENUE_SORTS)[number];

export type RevenuePurchase = {
  id: string;
  user_id: string;
  option: string;
  status: string;
  amount_cents: number;
  credit_applied_cents?: number | null;
  referral_code_used?: string | null;
  promo_code_used?: string | null;
  successful_installments?: number | null;
  student_name?: string | null;
  student_email?: string | null;
  created_at: string;
};

export type RevenueInstallment = {
  purchase_id: string;
  installment_number: number;
  amount_cents: number;
  scheduled_at: string;
  paid_at?: string | null;
  status: string;
};

export type RevenueReward = {
  id: string;
  referrer_user_id?: string | null;
  referee_user_id?: string | null;
  purchase_id?: string | null;
  amount_cents: number;
  status: string;
  created_at: string;
  updated_at?: string | null;
};

export type RevenueProfile = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  cohort?: string | null;
};

export type RevenueMonthRow = {
  month: string;
  paying_students: number;
  sales_cents: number;
  installments_paid_cents: number;
  installments_due_cents: number;
  referrals_paid_cents: number;
  referrals_due_cents: number;
  cash_cents: number;
};

export type RevenueStatementLine = {
  date: string;
  label: string;
  status: string;
  amount_cents: number;
};

export type RevenueStatement = {
  user_id: string;
  name: string;
  email: string;
  cohort: string;
  option: string;
  purchase_status: string;
  sales_cents: number;
  paid_cents: number;
  due_cents: number;
  referrals_paid_cents: number;
  referrals_due_cents: number;
  months: string[];
  month_rows: RevenueMonthRow[];
  lines: RevenueStatementLine[];
};

const LIVE_PURCHASE = new Set(["pending", "active", "past_due"]);
const DUE_INSTALLMENT = new Set(["pending", "draft", "failed"]);
const PAID_REFERRAL = new Set(["applied"]);
const DUE_REFERRAL = new Set(["pending", "earned", "refund_due"]);

export function sastMonthKey(value: string | Date | null | undefined): string | null {
  const date = isoToSastDateAndTime(value).date;
  return date ? date.slice(0, 7) : null;
}

export function isLivePurchase(status: string): boolean {
  return LIVE_PURCHASE.has(status);
}

export function isDueInstallment(status: string): boolean {
  return DUE_INSTALLMENT.has(status);
}

export function isPaidInstallment(status: string): boolean {
  return status === "paid";
}

export function isCashInstallment(status: string): boolean {
  return isPaidInstallment(status) || isDueInstallment(status);
}

export function contractedSaleCents(purchase: RevenuePurchase, installments: RevenueInstallment[]): number {
  if (purchase.option === "plan_6") {
    if (installments.length) return installments.reduce((sum, row) => sum + Number(row.amount_cents || 0), 0);
    return Number(purchase.amount_cents || 0) * 6;
  }
  return Number(purchase.amount_cents || 0);
}

export function installmentsForPurchase(purchase: RevenuePurchase, recorded: RevenueInstallment[]): RevenueInstallment[] {
  const rows = recorded
    .filter((row) => row.purchase_id === purchase.id)
    .sort((a, b) => a.installment_number - b.installment_number);
  if (rows.length || purchase.option !== "plan_6") return rows;
  const paidCount = Math.max(0, Number(purchase.successful_installments || 0));
  const amount = Number(purchase.amount_cents || 0);
  const enrolledAt = new Date(purchase.created_at);
  if (Number.isNaN(enrolledAt.getTime()) || !amount) return [];
  return planInstallmentDates(enrolledAt, 6).map((scheduledAt, index) => {
    const paid = index < paidCount;
    return {
      purchase_id: purchase.id,
      installment_number: index + 1,
      amount_cents: amount,
      scheduled_at: scheduledAt.toISOString(),
      paid_at: paid ? (index === 0 ? purchase.created_at : scheduledAt.toISOString()) : null,
      status: paid ? "paid" : "pending",
    };
  });
}

function emptyBucket() {
  return {
    payingStudentIds: new Set<string>(),
    sales_cents: 0,
    installments_paid_cents: 0,
    installments_due_cents: 0,
    referrals_paid_cents: 0,
    referrals_due_cents: 0,
    cash_cents: 0,
  };
}

function takeBucket(months: Map<string, ReturnType<typeof emptyBucket>>, month: string | null) {
  if (!month) return null;
  const current = months.get(month) || emptyBucket();
  months.set(month, current);
  return current;
}

export function buildRevenueMonthRows(input: {
  purchases: RevenuePurchase[];
  installments: RevenueInstallment[];
  rewards: RevenueReward[];
}): RevenueMonthRow[] {
  const months = new Map<string, ReturnType<typeof emptyBucket>>();
  const installmentsByPurchase = new Map<string, RevenueInstallment[]>();
  input.installments.forEach((row) => {
    const list = installmentsByPurchase.get(row.purchase_id) || [];
    list.push(row);
    installmentsByPurchase.set(row.purchase_id, list);
  });

  input.purchases.forEach((purchase) => {
    const rows = installmentsForPurchase(purchase, installmentsByPurchase.get(purchase.id) || []);
    const saleMonth = sastMonthKey(purchase.created_at);
    const saleBucket = takeBucket(months, saleMonth);
    if (saleBucket && isLivePurchase(purchase.status)) {
      saleBucket.sales_cents += contractedSaleCents(purchase, rows);
      saleBucket.payingStudentIds.add(purchase.user_id);
    }
    if (purchase.option !== "plan_6" && saleBucket && isLivePurchase(purchase.status)) {
      saleBucket.cash_cents += Number(purchase.amount_cents || 0);
    }
    rows.forEach((row) => {
      const scheduledMonth = sastMonthKey(row.scheduled_at);
      const paidMonth = sastMonthKey(row.paid_at) || scheduledMonth;
      const amount = Number(row.amount_cents || 0);
      if (isPaidInstallment(row.status)) {
        const paid = takeBucket(months, paidMonth);
        if (paid) paid.installments_paid_cents += amount;
      }
      if (isDueInstallment(row.status)) {
        const due = takeBucket(months, scheduledMonth);
        if (due) due.installments_due_cents += amount;
      }
      if (isCashInstallment(row.status)) {
        const cash = takeBucket(months, scheduledMonth);
        if (cash) cash.cash_cents += amount;
      }
    });
  });

  input.rewards.forEach((reward) => {
    const amount = Number(reward.amount_cents || 0);
    if (PAID_REFERRAL.has(reward.status)) {
      const bucket = takeBucket(months, sastMonthKey(reward.updated_at || reward.created_at));
      if (bucket) bucket.referrals_paid_cents += amount;
      return;
    }
    if (DUE_REFERRAL.has(reward.status)) {
      const bucket = takeBucket(months, sastMonthKey(reward.created_at));
      if (bucket) bucket.referrals_due_cents += amount;
    }
  });

  return [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, bucket]) => ({
      month,
      paying_students: bucket.payingStudentIds.size,
      sales_cents: bucket.sales_cents,
      installments_paid_cents: bucket.installments_paid_cents,
      installments_due_cents: bucket.installments_due_cents,
      referrals_paid_cents: bucket.referrals_paid_cents,
      referrals_due_cents: bucket.referrals_due_cents,
      cash_cents: bucket.cash_cents,
    }));
}

export function totalRevenueRow(rows: RevenueMonthRow[], payingStudents: number): RevenueMonthRow {
  return rows.reduce(
    (total, row) => ({
      month: "total",
      paying_students: payingStudents,
      sales_cents: total.sales_cents + row.sales_cents,
      installments_paid_cents: total.installments_paid_cents + row.installments_paid_cents,
      installments_due_cents: total.installments_due_cents + row.installments_due_cents,
      referrals_paid_cents: total.referrals_paid_cents + row.referrals_paid_cents,
      referrals_due_cents: total.referrals_due_cents + row.referrals_due_cents,
      cash_cents: total.cash_cents + row.cash_cents,
    }),
    {
      month: "total",
      paying_students: payingStudents,
      sales_cents: 0,
      installments_paid_cents: 0,
      installments_due_cents: 0,
      referrals_paid_cents: 0,
      referrals_due_cents: 0,
      cash_cents: 0,
    }
  );
}

export function rollupRevenueMonthRows(rows: RevenueMonthRow[]): RevenueMonthRow[] {
  const months = new Map<string, RevenueMonthRow>();
  rows.forEach((row) => {
    const current = months.get(row.month) || {
      month: row.month,
      paying_students: 0,
      sales_cents: 0,
      installments_paid_cents: 0,
      installments_due_cents: 0,
      referrals_paid_cents: 0,
      referrals_due_cents: 0,
      cash_cents: 0,
    };
    current.paying_students += row.paying_students;
    current.sales_cents += row.sales_cents;
    current.installments_paid_cents += row.installments_paid_cents;
    current.installments_due_cents += row.installments_due_cents;
    current.referrals_paid_cents += row.referrals_paid_cents;
    current.referrals_due_cents += row.referrals_due_cents;
    current.cash_cents += row.cash_cents;
    months.set(row.month, current);
  });
  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export function sortRevenueRows(rows: RevenueMonthRow[], key: RevenueSortKey, direction: "asc" | "desc"): RevenueMonthRow[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === "month") return a.month.localeCompare(b.month) * sign;
    return (Number(a[key]) - Number(b[key])) * sign;
  });
}

export function optionLabel(option: string): string {
  if (option === "plan_6") return "6-month plan";
  if (option === "once_off") return "Once-off";
  return option || "No purchase";
}

export function buildRevenueStatements(input: {
  purchases: RevenuePurchase[];
  installments: RevenueInstallment[];
  rewards: RevenueReward[];
  profiles: RevenueProfile[];
}): RevenueStatement[] {
  const profileById = new Map(input.profiles.map((row) => [row.id, row]));
  const installmentsByPurchase = new Map<string, RevenueInstallment[]>();
  input.installments.forEach((row) => {
    const list = installmentsByPurchase.get(row.purchase_id) || [];
    list.push(row);
    installmentsByPurchase.set(row.purchase_id, list);
  });
  const purchasesByUser = new Map<string, RevenuePurchase[]>();
  input.purchases.forEach((purchase) => {
    const list = purchasesByUser.get(purchase.user_id) || [];
    list.push(purchase);
    purchasesByUser.set(purchase.user_id, list);
  });
  const userIds = new Set<string>([
    ...input.purchases.map((row) => row.user_id),
    ...input.rewards.map((row) => row.referrer_user_id || "").filter(Boolean),
    ...input.rewards.map((row) => row.referee_user_id || "").filter(Boolean),
  ]);

  return [...userIds]
    .map((userId) => {
      const profile = profileById.get(userId);
      const purchases = (purchasesByUser.get(userId) || []).sort((a, b) => a.created_at.localeCompare(b.created_at));
      const latest = purchases[purchases.length - 1];
      const lines: RevenueStatementLine[] = [];
      const months = new Set<string>();
      let sales = 0;
      let paid = 0;
      let due = 0;

      purchases.forEach((purchase) => {
        const rows = installmentsForPurchase(purchase, installmentsByPurchase.get(purchase.id) || []);
        const sale = contractedSaleCents(purchase, rows);
        if (isLivePurchase(purchase.status)) sales += sale;
        const saleMonth = sastMonthKey(purchase.created_at);
        if (saleMonth) months.add(saleMonth);
        lines.push({
          date: purchase.created_at,
          label: `${optionLabel(purchase.option)} · January 2027 IAC Skills Course`,
          status: purchase.status,
          amount_cents: sale,
        });
        if (purchase.credit_applied_cents) {
          lines.push({
            date: purchase.created_at,
            label: "Referral / course credit applied",
            status: "applied",
            amount_cents: -Number(purchase.credit_applied_cents || 0),
          });
        }
        if (purchase.option !== "plan_6" && isLivePurchase(purchase.status)) {
          paid += Number(purchase.amount_cents || 0);
          lines.push({
            date: purchase.created_at,
            label: "Once-off payment",
            status: "paid",
            amount_cents: Number(purchase.amount_cents || 0),
          });
        }
        rows.forEach((row) => {
          const month = sastMonthKey(isPaidInstallment(row.status) ? row.paid_at || row.scheduled_at : row.scheduled_at);
          if (month) months.add(month);
          if (isPaidInstallment(row.status)) paid += Number(row.amount_cents || 0);
          if (isDueInstallment(row.status)) due += Number(row.amount_cents || 0);
          lines.push({
            date: row.paid_at || row.scheduled_at,
            label: `Instalment ${row.installment_number} of 6`,
            status: row.status,
            amount_cents: Number(row.amount_cents || 0),
          });
        });
      });

      let referralsPaid = 0;
      let referralsDue = 0;
      const ownRewards = input.rewards.filter((row) => row.referrer_user_id === userId || row.referee_user_id === userId);
      ownRewards.forEach((reward) => {
          const month = sastMonthKey(reward.updated_at || reward.created_at);
          if (month) months.add(month);
          const asReferrer = reward.referrer_user_id === userId;
          const label = asReferrer ? "Referral payout / credit earned" : "Referral discount on this enrolment";
          if (PAID_REFERRAL.has(reward.status)) referralsPaid += Number(reward.amount_cents || 0);
          if (DUE_REFERRAL.has(reward.status) && asReferrer) referralsDue += Number(reward.amount_cents || 0);
          lines.push({
            date: reward.updated_at || reward.created_at,
            label,
            status: reward.status,
            amount_cents: Number(reward.amount_cents || 0),
          });
        });

      const month_rows = buildRevenueMonthRows({
        purchases,
        installments: purchases.flatMap((purchase) =>
          installmentsForPurchase(purchase, installmentsByPurchase.get(purchase.id) || [])
        ),
        rewards: ownRewards.filter((reward) => reward.referrer_user_id === userId),
      });

      return {
        user_id: userId,
        name:
          String(profile?.full_name || "").trim() ||
          String(latest?.student_name || "").trim() ||
          String(profile?.email || latest?.student_email || "").trim() ||
          "Student",
        email: String(profile?.email || latest?.student_email || "").trim(),
        cohort: String(profile?.cohort || "").trim(),
        option: latest?.option || "",
        purchase_status: latest?.status || "none",
        sales_cents: sales,
        paid_cents: paid,
        due_cents: due,
        referrals_paid_cents: referralsPaid,
        referrals_due_cents: referralsDue,
        months: [...months].sort(),
        month_rows,
        lines: lines.sort((a, b) => a.date.localeCompare(b.date)),
      };
    })
    .filter((row) => row.sales_cents || row.paid_cents || row.due_cents || row.referrals_paid_cents || row.referrals_due_cents || row.lines.length)
    .sort((a, b) => a.name.localeCompare(b.name) || a.email.localeCompare(b.email));
}
