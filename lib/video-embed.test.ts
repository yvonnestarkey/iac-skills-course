import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  embedSrcForVideo,
  isYouTubeEmbed,
  youtubeVideoId,
  youtubeWatchUrl,
  YOUTUBE_EMBED_REFERRER_POLICY,
} from "./video-embed";

test("the SAICA YouTube clip on ch5-l2 becomes a standard embed", () => {
  const stored = "https://www.youtube.com/embed/ra8_R5XWd8g?si=cCs8AifHt-csEYN8";
  assert.equal(youtubeVideoId(stored), "ra8_R5XWd8g");
  assert.equal(embedSrcForVideo(stored), "https://www.youtube.com/embed/ra8_R5XWd8g?feature=oembed");
  assert.equal(youtubeWatchUrl(stored), "https://www.youtube.com/watch?v=ra8_R5XWd8g");
  assert.equal(isYouTubeEmbed(embedSrcForVideo(stored) || ""), true);
});

test("watch and short YouTube links resolve to the same embed", () => {
  assert.equal(youtubeVideoId("https://youtu.be/ra8_R5XWd8g"), "ra8_R5XWd8g");
  assert.equal(youtubeVideoId("https://www.youtube.com/watch?v=ra8_R5XWd8g"), "ra8_R5XWd8g");
  assert.equal(embedSrcForVideo("https://vimeo.com/701654979"), "https://player.vimeo.com/video/701654979");
});

test("the lesson player uses YouTube's required referrer policy", () => {
  const player = readFileSync(resolve("components/lesson/VideoPlayer.tsx"), "utf8");
  assert.match(player, /YOUTUBE_EMBED_REFERRER_POLICY/);
  assert.match(player, /referrerPolicy/);
  assert.match(player, /Open it on YouTube/);
  assert.equal(YOUTUBE_EMBED_REFERRER_POLICY, "strict-origin-when-cross-origin");
});
