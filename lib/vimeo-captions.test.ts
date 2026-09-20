import assert from "node:assert/strict";
import { test } from "node:test";
import { parseVttCues, pickEnglishTrack, trackDownloadUrl, transcriptFromCues } from "./vimeo-captions";

test("parseVttCues extracts timed source text and strips tags", () => {
  const cues = parseVttCues(`WEBVTT

1
00:00:01.000 --> 00:00:03.000
<c>Hello</c> class

2
00:00:04.000 --> 00:00:06.500
This is the <b>source</b> material
`);
  assert.equal(cues.length, 2);
  assert.equal(cues[0].start, "00:00:01.000");
  assert.equal(cues[0].text, "Hello class");
  assert.equal(transcriptFromCues(cues), "Hello class This is the source material");
});

test("pickEnglishTrack prefers English captions over other tracks", () => {
  const track = pickEnglishTrack([
    { language: "af", type: "captions", link: "https://example.com/af.vtt" },
    { language: "en", type: "subtitles", link: "https://example.com/en-sub.vtt" },
    { language: "en-GB", type: "captions", active: true, download_links: { vtt: "https://example.com/en.vtt" } },
  ]);
  assert.equal(trackDownloadUrl(track), "https://example.com/en.vtt");
});
