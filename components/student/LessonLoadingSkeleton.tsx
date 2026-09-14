export function LessonPdfPlaceholder() {
  return (
    <section className="lesson-pdf-viewer w-full">
      <div className="lesson-pdf-header">
        <div>
          <h2>PDF resource</h2>
          <p className="muted">This file is for this lesson. It is not a submission.</p>
        </div>
      </div>
      <div className="lesson-pdf-frame lesson-pdf-frame--loading w-full h-[80vh]" aria-busy="true" aria-label="Loading PDF">
        <div className="lesson-pdf-skeleton" />
      </div>
    </section>
  );
}

export default function LessonLoadingSkeleton() {
  return (
    <article className="lesson-body" aria-busy="true" aria-label="Loading lesson">
      <p className="kicker lesson-skeleton-line" />
      <div className="lesson-skeleton-title" />
      <div className="lesson-skeleton-text" />
      <div className="lesson-skeleton-text lesson-skeleton-text--short" />
      <div className="lesson-pdf-frame lesson-pdf-frame--loading w-full h-[80vh]">
        <div className="lesson-pdf-skeleton" />
      </div>
    </article>
  );
}
