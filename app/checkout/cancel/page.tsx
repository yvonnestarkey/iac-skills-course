import Link from "next/link";

export default function CheckoutCancelPage() {
  return (
    <section className="card login">
      <h1 className="brand">Checkout canceled</h1>
      <p className="muted">No payment was taken. Your free preview account is unchanged.</p>
      <div className="actions">
        <Link className="primary" href="/checkout">
          Try again
        </Link>
        <Link className="ghost" href="/student">
          Return to preview
        </Link>
      </div>
    </section>
  );
}
