"use client";

import { useEffect, useRef, useState } from "react";

const SRC = "/tools/variance-bakery.html";
const MIN_HEIGHT = 720;

type BakeryMessage =
  | { type: "variance-bakery:height"; height: number }
  | { type: "variance-bakery:result"; scenario?: string; wrong?: number; wrongRounds?: number; picturesUnlocked?: boolean };

/** Full-width iframe for the Task 1 Variance Bakery. Height comes from the tool's postMessage. */
export default function VarianceBakeryEmbed({ onComplete }: { onComplete?: () => void }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(MIN_HEIGHT);
  const completed = useRef(false);

  useEffect(() => {
    const onMessage = (event: MessageEvent<BakeryMessage>) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "variance-bakery:height" && Number.isFinite(data.height)) {
        setHeight(Math.max(MIN_HEIGHT, Math.round(data.height)));
      }
      if (data.type === "variance-bakery:result" && !completed.current) {
        completed.current = true;
        onComplete?.();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onComplete]);

  return (
    <div className="variance-bakery-wrap">
      <iframe
        ref={frameRef}
        className="variance-bakery-frame"
        src={SRC}
        title="Variance Bakery"
        style={{ height }}
      />
    </div>
  );
}
