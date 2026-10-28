import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SIM } from "../src/domain.ts";
import {
  checkLessonDraft,
  createLessonDraft,
  lessonDraftSignature,
  parseLessonDraft,
  resetLessonParameters,
  showLessonHint,
  updateLessonDraft,
} from "../src/learning.ts";

test("a course draft preserves parameters, target, hint and reference grid across refresh", () => {
  let draft = updateLessonDraft(createLessonDraft(), "apertureIndex", 4);
  draft = updateLessonDraft(draft, "depthGoal", "context");
  draft = { ...showLessonHint(draft), grid: true };
  const submitted = checkLessonDraft("depth", draft);
  assert.equal(submitted.feedback.passed, true);
  assert.equal(submitted.record, true);
  const restored = parseLessonDraft(JSON.stringify(submitted.draft));
  assert.deepEqual(restored, submitted.draft);
  assert.equal(checkLessonDraft("depth", restored).record, false);
});

test("identical checks and reference-grid changes cannot inflate attempts", () => {
  const first = checkLessonDraft("motion", createLessonDraft());
  assert.equal(first.record, true);
  assert.equal(first.feedback.passed, false);
  assert.equal(checkLessonDraft("motion", first.draft).record, false);
  const unchanged = updateLessonDraft(first.draft, "shutterIndex", 2);
  assert.equal(unchanged, first.draft);
  assert.equal(
    checkLessonDraft("motion", { ...unchanged, grid: true }).record,
    false,
  );
  const temporarilyChanged = updateLessonDraft(first.draft, "shutterIndex", 3);
  const returned = updateLessonDraft(temporarilyChanged, "shutterIndex", 2);
  assert.equal(returned.checked, false);
  assert.equal(checkLessonDraft("motion", returned).record, false);
});

test("changed settings invalidate displayed feedback and permit one new check", () => {
  const first = checkLessonDraft("motion", createLessonDraft());
  let changed = updateLessonDraft(first.draft, "shutterIndex", 4);
  changed = updateLessonDraft(changed, "isoIndex", 3);
  assert.equal(changed.checked, false);
  assert.equal(
    changed.lastRecordedSignature,
    first.draft.lastRecordedSignature,
  );
  const next = checkLessonDraft("motion", changed);
  assert.equal(next.feedback.passed, true);
  assert.equal(next.record, true);
  assert.equal(checkLessonDraft("motion", next.draft).record, false);
});

test("hint use remains recorded after edits, parameter reset, and refresh", () => {
  let draft = showLessonHint(createLessonDraft());
  draft = updateLessonDraft(draft, "apertureIndex", 0);
  draft = updateLessonDraft(draft, "depthGoal", "context");
  const reset = resetLessonParameters(draft);
  assert.equal(reset.hint, true);
  assert.deepEqual(reset.sim, { ...DEFAULT_SIM, depthGoal: "context" });
  assert.equal(reset.checked, false);
  const restored = parseLessonDraft(JSON.stringify(reset));
  assert.equal(restored.hint, true);
  const checked = checkLessonDraft("depth", restored);
  assert.equal(
    checkLessonDraft("depth", showLessonHint(checked.draft)).record,
    false,
  );
});

test("viewing a hint changes attempt evidence once, and reopening it is a no-op", () => {
  const noHint = checkLessonDraft("composition", createLessonDraft()).draft;
  const helped = showLessonHint(noHint);
  assert.equal(helped.checked, false);
  assert.notEqual(lessonDraftSignature(helped), lessonDraftSignature(noHint));
  const checked = checkLessonDraft("composition", helped);
  assert.equal(checked.record, true);
  assert.equal(showLessonHint(checked.draft), checked.draft);
  assert.equal(checkLessonDraft("composition", checked.draft).record, false);
});

test("corrupt or future drafts safely default; only bounded teaching values are restored", () => {
  for (const raw of [
    null,
    "{",
    "null",
    "[]",
    '{"version":2,"sim":{}}',
    '{"version":1,"sim":[]}',
    " ".repeat(3001),
  ]) {
    assert.deepEqual(parseLessonDraft(raw), createLessonDraft());
  }
  const restored = parseLessonDraft(
    JSON.stringify({
      version: 1,
      sim: {
        shutterIndex: 99,
        apertureIndex: -1,
        isoIndex: 1.5,
        viewpoint: "2",
        depthGoal: "not-a-goal",
        image: "data:image/jpeg;base64,ignored",
      },
      hint: "true",
      checked: 1,
      grid: "true",
      photo: "blob:untrusted-url",
    }),
  );
  assert.deepEqual(restored, createLessonDraft());
  assert.equal("photo" in restored, false);
  assert.equal("image" in restored.sim, false);
  assert.equal(
    updateLessonDraft(createLessonDraft(), "isoIndex", Infinity).sim.isoIndex,
    DEFAULT_SIM.isoIndex,
  );
});

test("initial v1 checked drafts migrate without counting the same checked attempt again", () => {
  const restored = parseLessonDraft(
    JSON.stringify({
      version: 1,
      sim: DEFAULT_SIM,
      hint: true,
      checked: true,
      grid: true,
    }),
  );
  assert.equal(restored.checked, true);
  assert.equal(restored.hint, true);
  assert.equal(restored.lastRecordedSignature, lessonDraftSignature(restored));
  assert.equal(checkLessonDraft("motion", restored).record, false);
});

test("stale or invalid saved check signatures do not display feedback for changed settings", () => {
  const checked = checkLessonDraft("motion", createLessonDraft()).draft;
  const stale = parseLessonDraft(
    JSON.stringify({ ...checked, sim: { ...checked.sim, shutterIndex: 4 } }),
  );
  assert.equal(stale.checked, false);
  assert.equal(checkLessonDraft("motion", stale).record, true);
  for (const signature of [
    "not-json",
    "[]",
    '[0,0,0,0,"subject","true"]',
    '[999,0,0,0,"subject",true]',
    "x".repeat(121),
    null,
  ]) {
    const invalid = parseLessonDraft(
      JSON.stringify({ ...checked, lastRecordedSignature: signature }),
    );
    assert.equal(invalid.checked, false);
    assert.equal(invalid.lastRecordedSignature, null);
  }
});

test("unsubmitted changes survive refresh without becoming completed evidence", () => {
  const changed = updateLessonDraft(createLessonDraft(), "viewpoint", 1);
  const restored = parseLessonDraft(JSON.stringify(changed));
  assert.equal(restored.checked, false);
  assert.equal(restored.lastRecordedSignature, null);
  const check = checkLessonDraft("composition", restored);
  assert.equal(check.feedback.passed, true);
  assert.equal(check.record, true);
});
