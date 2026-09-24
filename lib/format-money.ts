/** Exact USD cents for display. Does not change ledger or referral maths. */
export function formatUsdCents(cents: number): string {
  const value = Number.isFinite(cents) ? cents / 100 : 0;
  return `US$${value.toFixed(2)}`;
}
