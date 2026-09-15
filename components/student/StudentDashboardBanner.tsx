"use client";

import { useEffect, useState } from "react";
import { DEFAULT_COACHING_CONFIG, fetchCoachingPageConfig, type CoachingPageConfig } from "@/lib/coaching";

export default function StudentDashboardBanner() {
  const [config, setConfig] = useState<CoachingPageConfig>(DEFAULT_COACHING_CONFIG);

  useEffect(() => {
    fetchCoachingPageConfig().then((next) => {
      console.log("Dashboard Config:", next);
      setConfig(next);
    });
  }, []);

  if (!config.dashboard_banner_url) return null;

  return (
    <div className="dashboard-banner-wrap">
      <img className="dashboard-banner" src={config.dashboard_banner_url} alt="" />
    </div>
  );
}
