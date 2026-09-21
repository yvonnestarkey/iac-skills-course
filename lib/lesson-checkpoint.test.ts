import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isProgressiveCheckpoint,
  parseCheckpointNotes,
  serializeCheckpointNotes,
} from "./lesson-checkpoint";

test("video lessons with a survey and a clip are progressive checkpoints", () => {
  assert.equal(
    isProgressiveCheckpoint({
      type: "video",
      survey_id: "survey-1",
      video_url: "https://player.vimeo.com/video/1144779004",
    }),
    true
  );
  assert.equal(
    isProgressiveCheckpoint({
      type: "survey",
      survey_id: "survey-1",
      video_url: "https://player.vimeo.com/video/1144779004",
    }),
    false
  );
  assert.equal(
    isProgressiveCheckpoint({
      type: "video",
      survey_id: "survey-1",
      videos: [],
    }),
    false
  );
});

test("checkpoint notes round-trip submitted answers", () => {
  const notes = serializeCheckpointNotes({
    submitted: true,
    answers: { "q-tools-used": "BMCR; RTFQ" },
  });
  assert.match(notes, /^checkpoint-v1:/);
  assert.deepEqual(parseCheckpointNotes(notes), {
    submitted: true,
    answers: { "q-tools-used": "BMCR; RTFQ" },
  });
});
