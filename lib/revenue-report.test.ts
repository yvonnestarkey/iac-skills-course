import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRevenueMonthRows,
  buildRevenueStatements,
  excludeTestStudents,
  isTestStudentEmail,
  sortRevenueRows,
  totalRevenueRow,
  uniquePayingStudents,
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
  assert.ok(statement.contributions.some((row) => row.kind === "installment_due" && row.amount_cents === 5700));
  assert.equal(statement.discount_cents, 0);
  assert.equal(
    statement.lines.find((line) => line.label.includes("IAC Skills Course"))?.amount_cents,
    11400
  );
});

test("referred plan statements show the $360 sale, $18 given discount, and the referrer", () => {
  const statements = buildRevenueStatements({
    purchases: [
      {
        id: "p1",
        user_id: "pitse",
        option: "plan_6",
        status: "active",
        amount_cents: 34200,
        successful_installments: 1,
        referral_code_used: "JAN27-ADA",
        created_at: "2026-10-20T10:00:00.000Z",
      },
    ],
    installments: [],
    rewards: [
      {
        id: "r1",
        referrer_user_id: "ada",
        referee_user_id: "pitse",
        purchase_id: "p1",
        amount_cents: 3270,
        status: "earned",
        created_at: "2026-10-20T10:05:00.000Z",
      },
    ],
    profiles: [
      { id: "pitse", full_name: "Pitse Bontle", email: "bontle.pitse@kpmg.co.za", cohort: "jan27" },
      { id: "ada", full_name: "Ada Molefe", email: "ada@example.com", cohort: "jan27" },
    ],
    referrersByCode: { "JAN27-ADA": { name: "Ada Molefe", user_id: "ada" } },
  });
  const pitse = statements.find((row) => row.user_id === "pitse");
  const ada = statements.find((row) => row.user_id === "ada");
  assert.ok(pitse);
  assert.equal(pitse.sales_cents, 34200);
  assert.equal(pitse.discount_cents, 1800);
  assert.equal(pitse.discount_label, "Referral discount (Ada Molefe)");
  assert.equal(pitse.lines.find((line) => line.label.includes("IAC Skills Course"))?.amount_cents, 36000);
  assert.deepEqual(
    pitse.lines.find((line) => line.label.startsWith("Referral discount")),
    {
      date: "2026-10-20T10:00:00.000Z",
      label: "Referral discount (Ada Molefe)",
      status: "given",
      amount_cents: -1800,
    }
  );
  assert.equal(
    pitse.lines.some((line) => line.amount_cents === 3270 || line.label.includes("earned")),
    false
  );
  assert.ok(ada);
  assert.equal(ada.lines.find((line) => line.label.includes("Referral credit"))?.label, "Referral credit earned (Pitse Bontle)");
  assert.equal(ada.referrals_due_cents, 3270);
});

test("pending checkouts are not sales, and plan amount_cents is already the full total", () => {
  const rows = buildRevenueMonthRows({
    purchases: [
      {
        id: "pending",
        user_id: "u1",
        option: "plan_6",
        status: "pending",
        amount_cents: 36000,
        created_at: "2026-10-01T10:00:00.000Z",
      },
      {
        id: "active",
        user_id: "u1",
        option: "plan_6",
        status: "active",
        amount_cents: 36000,
        successful_installments: 1,
        created_at: "2026-10-02T10:00:00.000Z",
      },
    ],
    installments: [],
    rewards: [],
  });
  const october = rows.find((row) => row.month === "2026-10");
  assert.ok(october);
  assert.equal(october.paying_students, 1);
  assert.equal(october.sales_cents, 36000);
  assert.equal(october.cash_cents, 6000);
  assert.equal(october.installments_paid_cents, 6000);
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

test("cohort total counts unique buyers, not a referrer and not the sum of months", () => {
  const statements = buildRevenueStatements({
    purchases: [
      {
        id: "p1",
        user_id: "u1",
        option: "once_off",
        status: "active",
        amount_cents: 32700,
        created_at: "2026-09-03T08:00:00.000Z",
      },
      {
        id: "p2",
        user_id: "u2",
        option: "plan_6",
        status: "active",
        amount_cents: 36000,
        successful_installments: 1,
        created_at: "2026-10-02T10:00:00.000Z",
      },
      {
        id: "pending",
        user_id: "u3",
        option: "once_off",
        status: "pending",
        amount_cents: 32700,
        created_at: "2026-10-05T10:00:00.000Z",
      },
    ],
    installments: [],
    rewards: [
      {
        id: "r1",
        referrer_user_id: "u3",
        amount_cents: 3270,
        status: "earned",
        created_at: "2026-10-06T10:00:00.000Z",
      },
    ],
    profiles: [
      { id: "u1", email: "one@example.com" },
      { id: "u2", email: "two@example.com" },
      { id: "u3", email: "ref@example.com" },
    ],
  });
  const months = statements.flatMap((row) => row.month_rows);
  assert.equal(uniquePayingStudents(months), 2);
  assert.equal(totalRevenueRow(months).paying_students, 2);
});

test("emails containing @test are dropped from revenue", () => {
  assert.equal(isTestStudentEmail("ada@test.com"), true);
  assert.equal(isTestStudentEmail("ada@Test.local"), true);
  assert.equal(isTestStudentEmail("ada@example.com"), false);
  const live = excludeTestStudents({
    purchases: [
      {
        id: "real",
        user_id: "u1",
        option: "once_off",
        status: "active",
        amount_cents: 32700,
        created_at: "2026-09-03T08:00:00.000Z",
      },
      {
        id: "fake",
        user_id: "u2",
        option: "once_off",
        status: "active",
        amount_cents: 32700,
        student_email: "script@test.com",
        created_at: "2026-09-04T08:00:00.000Z",
      },
    ],
    installments: [],
    rewards: [
      { id: "r1", referrer_user_id: "u2", amount_cents: 3270, status: "earned", created_at: "2026-09-04T08:00:00.000Z" },
    ],
    profiles: [
      { id: "u1", email: "ada@example.com" },
      { id: "u2", email: "script@test.com" },
    ],
  });
  assert.equal(live.purchases.length, 1);
  assert.equal(live.purchases[0].user_id, "u1");
  assert.equal(live.rewards.length, 0);
  const rows = buildRevenueMonthRows(live);
  assert.equal(rows[0].sales_cents, 32700);
  assert.equal(rows[0].paying_students, 1);
});
