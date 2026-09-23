import BrandMark from "@/components/BrandMark";
import WaitlistForm from "@/components/sales/WaitlistForm";
import {
  COLD_VIDEO,
  REGISTRATION_CONTACT_EMAIL,
  REGISTRATION_CONTACT_LABEL,
  REGISTRATION_HEADLINE,
  REGISTRATION_NOTE,
  REGISTRATION_PAYMENT,
  SALES_BADGE,
  SALES_VIDEO,
  WEBINAR,
} from "@/lib/sales-copy";

function SalesVideo({ video }: { video: { title: string; src: string } }) {
  return (
    <div className="sales-video">
      <p className="kicker">{video.title}</p>
      <div className="sales-video-frame">
        <iframe
          src={video.src}
          title={video.title}
          allow="autoplay; fullscreen; picture-in-picture; clipboard-write"
          allowFullScreen
        />
      </div>
    </div>
  );
}

export default function RegistrationLanding() {
  return (
    <div className="sales-page">
      <a className="sales-webinar-banner" href={WEBINAR.href} target="_blank" rel="noopener noreferrer">
        <strong>{WEBINAR.kicker}</strong>
        <span>{WEBINAR.body}</span>
        <span className="sales-webinar-cta">{WEBINAR.cta}</span>
      </a>
      <header className="topbar sales-topbar">
        <BrandMark href="/" />
      </header>

      <section className="sales-registration">
        <p className="sales-badge">{SALES_BADGE}</p>
        <h1>{REGISTRATION_HEADLINE}</h1>
        <div className="sales-registration-columns">
          <div className="card sales-lead-card">
            <WaitlistForm />
          </div>
          <aside className="card sales-contact-card">
            <a className="primary" href="/register">
              Create free account
            </a>
            <a className="ghost" href={`mailto:${REGISTRATION_CONTACT_EMAIL}`}>
              {REGISTRATION_CONTACT_LABEL}
            </a>
            <p>{REGISTRATION_NOTE}</p>
            <p className="sales-registration-payment">{REGISTRATION_PAYMENT}</p>
          </aside>
        </div>
        <div className="sales-registration-videos">
          <SalesVideo video={SALES_VIDEO} />
          <SalesVideo video={COLD_VIDEO} />
        </div>
      </section>

      <footer className="sales-footer">
        <BrandMark href="/" />
        <p className="muted small">Accounting Study Advice · IAC Skills Board Course</p>
      </footer>
    </div>
  );
}
