import Link from "next/link";

export default function WelcomePage() {
  return (
    <section className="card login">
      <p className="kicker">Account created</p>
      <h1 className="brand">Your free Jan 2027 account is ready</h1>
      <p className="muted">This is the same account you will keep if you buy. Preview first, or get full access now.</p>
      <div className="actions">
        <Link className="primary" href="/checkout">
          Get full course access — Buy Jan 2027 IAC Course
        </Link>
        <Link className="ghost" href="/student">
          Have a look around first — Preview course for free
        </Link>
      </div>
    </section>
  );
}
