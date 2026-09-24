import BrandMark from "@/components/BrandMark";
import EnrolmentOffer from "@/components/sales/EnrolmentOffer";
import {
  COLD_VIDEO,
  REGISTRATION_HEADLINE,
  SALES_BADGE,
  SALES_VIDEO,
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
      <header className="topbar sales-topbar">
        <BrandMark href="/" />
      </header>

      <section className="sales-registration">
        <p className="sales-badge">{SALES_BADGE}</p>
        <h1>{REGISTRATION_HEADLINE}</h1>
        <div className="sales-registration-columns">
          <SalesVideo video={SALES_VIDEO} />
          <div className="card sales-lead-card">
            <EnrolmentOffer />
          </div>
        </div>
        <div className="sales-registration-videos">
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
