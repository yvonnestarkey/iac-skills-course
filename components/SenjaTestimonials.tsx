"use client";

import Script from "next/script";

export default function SenjaTestimonials() {
  return (
    <>
      <Script
        src="https://widget.senja.io/widget/69b6de18-e439-4b55-bb9c-c9f6f5e21d57/platform.js"
        strategy="lazyOnload"
      />
      <div
        className="senja-embed"
        data-id="69b6de18-e439-4b55-bb9c-c9f6f5e21d57"
        data-mode="shadow"
        data-lazyload="false"
        style={{ display: "block", width: "100%" }}
      />
    </>
  );
}
