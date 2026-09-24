import Link from "next/link";
import {
  ENROLMENT_BODY,
  ENROLMENT_CTA,
  ENROLMENT_TITLE,
  PAYMENT_CAPTION,
  PRICING_TIERS,
  WAITLIST_FIRM_NOTE,
} from "@/lib/sales-copy";

export default function EnrolmentOffer() {
  return (
    <div className="enrolment-offer">
      <h2>{ENROLMENT_TITLE}</h2>
      <p className="muted">{ENROLMENT_BODY}</p>
      <ul className="enrolment-offer-plans">
        {PRICING_TIERS.map((tier) => (
          <li key={tier.id}>
            <p className="kicker">{tier.kicker}</p>
            <p className="enrolment-offer-price">{tier.price}</p>
            <p className="muted small">{tier.detail}</p>
          </li>
        ))}
      </ul>
      <p className="muted small">{PAYMENT_CAPTION}</p>
      <Link className="primary" href="/register">
        {ENROLMENT_CTA}
      </Link>
      <p className="muted small enrolment-offer-signin">
        <Link href="/login">Already have an account? Sign in</Link>
      </p>
      <p className="muted small waitlist-firm-note">{WAITLIST_FIRM_NOTE}</p>
    </div>
  );
}
