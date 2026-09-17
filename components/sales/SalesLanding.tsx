import BrandMark from "@/components/BrandMark";
import SenjaTestimonials from "@/components/SenjaTestimonials";
import CourseFeatures from "@/components/sales/CourseFeatures";
import FaqAccordion from "@/components/sales/FaqAccordion";
import SkillsAccordion from "@/components/sales/SkillsAccordion";
import WaitlistForm from "@/components/sales/WaitlistForm";
import { COURSE_DATES, PRICING_TIERS, REFERRAL, SALES_AUDIENCE, SALES_BADGE, SALES_HEADLINE, SALES_SUBHEAD, SALES_VIDEO } from "@/lib/sales-copy";
import Link from "next/link";

export default function SalesLanding() {
  return (
    <div className="sales-page">
      <header className="topbar sales-topbar">
        <BrandMark href="/" />
        <Link className="ghost" href="/login">
          Student / Coach Login ↗
        </Link>
      </header>

      <section className="sales-hero">
        <div className="sales-hero-copy">
          <p className="sales-badge">{SALES_BADGE}</p>
          <h1>{SALES_HEADLINE}</h1>
          <p className="sales-audience">{SALES_AUDIENCE}</p>
          <p className="lead">{SALES_SUBHEAD}</p>
          <div className="sales-video">
            <p className="kicker">{SALES_VIDEO.title}</p>
            <div className="sales-video-frame">
              <iframe
                src={SALES_VIDEO.src}
                title={SALES_VIDEO.title}
                allow="autoplay; fullscreen; picture-in-picture; clipboard-write"
                allowFullScreen
              />
            </div>
          </div>
        </div>
        <div className="card sales-lead-card">
          <WaitlistForm />
        </div>
      </section>

      <CourseFeatures />

      <section className="sales-section" id="skills">
        <h2>What Skills will we work on?</h2>
        <p className="muted sales-intro">
          These practical Skills improve your ability to answer questions and get marks for what you already know
        </p>
        <SkillsAccordion />
      </section>

      <section className="sales-section sales-dates" id="dates">
        <p className="kicker">{COURSE_DATES.kicker}</p>
        <h2>{COURSE_DATES.title}</h2>
        <p className="muted sales-intro">{COURSE_DATES.body}</p>
      </section>

      <section className="sales-section" id="pricing">
        <p className="kicker">Pricing</p>
        <h2>Choose how you pay</h2>
        <div className="sales-pricing-grid">
          {PRICING_TIERS.map((tier) => (
            <article key={tier.id} className="card sales-price-card">
              <p className="kicker">{tier.kicker}</p>
              <h3>{tier.title}</h3>
              <p className="sales-price">{tier.price}</p>
              <p className="muted sales-price-detail">{tier.detail}</p>
              <p className="sales-price-body">{tier.body}</p>
            </article>
          ))}
        </div>
        <aside className="sales-referral">
          <h3>{REFERRAL.title}</h3>
          <p>{REFERRAL.body}</p>
        </aside>
      </section>

      <section className="sales-section" id="testimonials">
        <SenjaTestimonials />
      </section>

      <section className="sales-section" id="faq">
        <p className="kicker">Questions</p>
        <h2>Detailed FAQs</h2>
        <FaqAccordion />
      </section>

      <footer className="sales-footer">
        <BrandMark href="/" />
        <p className="muted small">Accounting Study Advice · IAC Skills Board Course</p>
        <Link href="/login">Student / Coach Login ↗</Link>
      </footer>
    </div>
  );
}
