import Link from "next/link";

export default function CheckoutSuccessPage() {
  return (
    <section className="card login">
      <h1 className="brand">Payment received!</h1>
      <p className="muted">Your full course access is being activated. This normally takes just a moment.</p>
      <Link className="primary" href="/student">
        Open the course
      </Link>
    </section>
  );
}
