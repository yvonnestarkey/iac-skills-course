import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRevenueMonthRows,
  buildRevenueStatements,
  sortRevenueRows,
  totalRevenueRow,
} from "./revenue-report";

test("monthly cash follows scheduled instalments, not the contracted sale", () => {
  const rows = buildRevenueMonthRows({
    purchases: [
      {
        id: "p1",
        user_id: "u1",
        option: "plan_6",
        status: "active",
        amount_cents: 5700,
        successful_installments: 1,
        created_at: "2026-10-15T10:00:00.000Z",
      },
    ],
    installments: [
      {
        purchase_id: "p1",
        installment_number: 1,
        amount_cents: 5700,
        scheduled_at: "2026-10-15T10:00:00.000Z",
        paid_at: "2026-10-15T10:00:00.000Z",
        status: "paid",
      },
      {
        purchase_id: "p1",
        installment_number: 2,
        amount_cents: 5700,
        scheduled_at: "2026-11-30T12:00:00.000Z",
        paid_at: null,
        status: "pending",
      },
    ],
    rewards: [],
  });

  const october = rows.find((row) => row.month === "2026-10");
  const november = rows.find((row) => row.month === "2026-11");
  assert.ok(october);
  assert.ok(november);
  assert.equal(october.sales_cents, 11400);
  assert.equal(october.installments_paid_cents, 5700);
  assert.equal(october.installments_due_cents, 0);
  assert.equal(october.cash_cents, 5700);
  assert.equal(november.sales_cents, 0);
  assert.equal(november.installments_due_cents, 5700);
  assert.equal(november.cash_cents, 5700);
});

test("once-off sale is cash in the enrolment month", () => {
  const rows = buildRevenueMonthRows({
    purchases: [
      {
        id: "p2",
        user_id: "u2",
        option: "once_off",
        status: "active",
        amount_cents: 32700,
        created_at: "2026-09-03T08:00:00.000Z",
      },
    ],
    installments: [],
    rewards: [],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].month, "2026-09");
  assert.equal(rows[0].sales_cents, 32700);
  assert.equal(rows[0].cash_cents, 32700);
  assert.equal(rows[0].installments_paid_cents, 0);
});

test("referrals paid and due land on the right months", () => {
  const rows = buildRevenueMonthRows({
    purchases: [],
    installments: [],
    rewards: [
      {
        id: "r1",
        referrer_user_id: "u3",
        amount_cents: 3270,
        status: "earned",
        created_at: "2026-10-01T12:00:00.000Z",
      },
      {
        id: "r2",
        referrer_user_id: "u3",
        amount_cents: 3270,
        status: "applied",
        created_at: "2026-09-01T12:00:00.000Z",
        updated_at: "2026-10-20T12:00:00.000Z",
      },
    ],
  });
  const september = rows.find((row) => row.month === "2026-09");
  const october = rows.find((row) => row.month === "2026-10");
  assert.equal(september?.referrals_paid_cents || 0, 0);
  assert.equal(october?.referrals_due_cents, 3270);
  assert.equal(october?.referrals_paid_cents, 3270);
});

test("student statement totals paid and due instalments", () => {
  const [statement] = buildRevenueStatements({
    purchases: [
      {
        id: "p1",
        user_id: "u1",
        option: "plan_6",
        status: "active",
        amount_cents: 5700,
        created_at: "2026-10-15T10:00:00.000Z",
      },
    ],
    installments: [
      {
        purchase_id: "p1",
        installment_number: 1,
        amount_cents: 5700,
        scheduled_at: "2026-10-15T10:00:00.000Z",
        paid_at: "2026-10-15T10:00:00.000Z",
        status: "paid",
      },
      {
        purchase_id: "p1",
        installment_number: 2,
        amount_cents: 5700,
        scheduled_at: "2026-11-30T12:00:00.000Z",
        status: "pending",
      },
    ],
    rewards: [],
    profiles: [{ id: "u1", full_name: "Ada", email: "ada@example.com", cohort: "jan27" }],
  });
  assert.equal(statement.name, "Ada");
  assert.equal(statement.paid_cents, 5700);
  assert.equal(statement.due_cents, 5700);
  assert.equal(statement.sales_cents, 11400);
  assert.ok(statement.lines.some((line) => line.label.includes("Instalment 2")));
  assert.ok(statement.month_rows.some((row) => row.month === "2026-11" && row.cash_cents === 5700));
});

test("sort and cohort total keep month rows and a pinned total", () => {
  const rows = [
    {
      month: "2026-11",
      paying_students: 1,
      sales_cents: 0,
      installments_paid_cents: 0,
      installments_due_cents: 5700,
      referrals_paid_cents: 0,
      referrals_due_cents: 0,
      cash_cents: 5700,
    },
    {
      month: "2026-10",
      paying_students: 2,
      sales_cents: 32700,
      installments_paid_cents: 5700,
      installments_due_cents: 0,
      referrals_paid_cents: 0,
      referrals_due_cents: 0,
      cash_cents: 38400,
    },
  ];
  const sorted = sortRevenueRows(rows, "cash_cents", "desc");
  assert.equal(sorted[0].month, "2026-10");
  const total = totalRevenueRow(rows, 3);
  assert.equal(total.month, "total");
  assert.equal(total.paying_students, 3);
  assert.equal(total.cash_cents, 44100);
});
