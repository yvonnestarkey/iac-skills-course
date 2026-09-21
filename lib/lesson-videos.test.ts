import assert from "node:assert/strict";
import { test } from "node:test";
import { firstLessonVideoUrl, isMultiVideoLesson, parseLessonVideos, videoIdentity, videoPartHeading } from "./lesson-videos";

test("plain URL strings become { url } and keep order", () => {
  const videos = parseLessonVideos([
    "https://player.vimeo.com/video/688023027",
    "https://player.vimeo.com/video/751136343",
    "https://player.vimeo.com/video/868313315",
  ]);
  assert.deepEqual(
    videos.map((item) => item.url),
    [
      "https://player.vimeo.com/video/688023027",
      "https://player.vimeo.com/video/751136343",
      "https://player.vimeo.com/video/868313315",
    ]
  );
  assert.equal(videos.every((item) => !item.heading && !item.after), true);
});

test("duplicate query variants keep the first occurrence only", () => {
  const videos = parseLessonVideos([
    "https://player.vimeo.com/video/875500116?badge=0&autopause=0&player_id=0&app_id=58479",
    "https://player.vimeo.com/video/875500116",
  ]);
  assert.equal(videos.length, 1);
  assert.equal(videos[0].url, "https://player.vimeo.com/video/875500116?badge=0&autopause=0&player_id=0&app_id=58479");
  assert.equal(videoIdentity(videos[0].url), "vimeo:875500116");
});

test("mixed string and structured items are parsed safely", () => {
  const videos = parseLessonVideos([
    "https://player.vimeo.com/video/746464515",
    {
      url: "https://player.vimeo.com/video/746590325",
      heading: "PART 2 — What does the exam ask you to do?",
      after: "So we've got two environments.",
    },
    { heading: "missing url is ignored" },
    null,
    "",
    {
      src: "https://player.vimeo.com/video/746762484",
      heading: "PART 3 — Comfortable vs Normal",
    },
    "https://player.vimeo.com/video/746464515?badge=0",
  ]);
  assert.deepEqual(videos, [
    { url: "https://player.vimeo.com/video/746464515" },
    {
      url: "https://player.vimeo.com/video/746590325",
      heading: "PART 2 — What does the exam ask you to do?",
      after: "So we've got two environments.",
    },
    {
      url: "https://player.vimeo.com/video/746762484",
      heading: "PART 3 — Comfortable vs Normal",
    },
  ]);
});

test("firstLessonVideoUrl matches the first unique clip", () => {
  assert.equal(
    firstLessonVideoUrl(undefined, [
      "https://player.vimeo.com/video/1033062260?badge=0",
      "https://player.vimeo.com/video/1033062260",
    ]),
    "https://player.vimeo.com/video/1033062260?badge=0"
  );
});

test("duplicate URL pairs stay on the single-video layout", () => {
  const videos = parseLessonVideos([
    "https://player.vimeo.com/video/1033062260?badge=0",
    "https://player.vimeo.com/video/1033062260",
  ]);
  assert.equal(isMultiVideoLesson("video", videos), false);
  assert.equal(isMultiVideoLesson("video", parseLessonVideos(["https://player.vimeo.com/video/1", "https://player.vimeo.com/video/2"])), true);
  assert.equal(isMultiVideoLesson("reading", parseLessonVideos(["https://player.vimeo.com/video/1", "https://player.vimeo.com/video/2"])), false);
});

test("videoPartHeading prefixes Part n of N without inventing a title", () => {
  assert.equal(videoPartHeading({ url: "https://player.vimeo.com/video/1", heading: "Rules vs Tools 1.mp4" }, 0, 3), "Part 1 of 3 — Rules vs Tools 1");
  assert.equal(videoPartHeading({ url: "https://player.vimeo.com/video/2", heading: "Part 2 of 3 — Rules vs Tools 2" }, 1, 3), "Part 2 of 3 — Rules vs Tools 2");
  assert.equal(videoPartHeading({ url: "https://player.vimeo.com/video/3" }, 2, 3), "Part 3 of 3");
});
