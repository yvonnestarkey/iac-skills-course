import Link from "next/link";

export default function CheckoutSuccessPage() {
  return (
    <section className="card login">
      <h1 className="brand">Payment received</h1>
      <p className="muted">
        Stripe is confirming your payment. Full Jan 2027 access is granted from the verified webhook, not this page. Refresh the course in a moment.
      </p>
      <Link className="primary" href="/student">
        Open the course
      </Link>
    </section>
  );
}
