import test from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_STATE,
  STORAGE_KEY,
  parseSavedState,
  preferenceLabel,
  recordComparison,
  recordLesson,
} from "../src/storage.ts";
import type { CompareRecord, LessonId, SavedState } from "../src/storage.ts";

const now = "2026-09-23T15:00:00.000Z";
const later = "2026-09-23T16:00:00.000Z";
const comparison = (overrides: Partial<CompareRecord> = {}): CompareRecord => ({
  id: "compare-01",
  source: "personal",
  preference: "before",
  goal: "保留环境",
  createdAt: now,
  ...overrides,
});

test("malformed, absent, oversized and unsupported persisted state returns a fresh empty state", () => {
  for (const raw of [
    null,
    "",
    "{",
    "null",
    "[]",
    "true",
    "42",
    '{"version":2,"lessons":{},"comparisons":[]}',
    '{"version":1}',
    " ".repeat(65_537),
  ]) {
    const parsed = parseSavedState(raw);
    assert.deepEqual(parsed, EMPTY_STATE);
    assert.notEqual(parsed, EMPTY_STATE);
  }
  const first = parseSavedState(null);
  first.comparisons.push(comparison());
  assert.equal(parseSavedState(null).comparisons.length, 0);
  assert.equal(EMPTY_STATE.comparisons.length, 0);
  assert.equal(STORAGE_KEY, "frame-mentor-v1");
});

test("lesson attempts retain past passing and hint use without mutating previous states", () => {
  const first = recordLesson(EMPTY_STATE, "motion", true, true, now);
  const second = recordLesson(first, "motion", false, false, later);
  assert.deepEqual(second.lessons.motion, {
    lessonId: "motion",
    attempts: 2,
    passed: true,
    usedHint: true,
    updatedAt: later,
  });
  assert.equal(first.lessons.motion?.attempts, 1);
  assert.deepEqual(EMPTY_STATE.lessons, {});
  assert.notEqual(second.lessons.motion, first.lessons.motion);
  assert.deepEqual(parseSavedState(JSON.stringify(second)), second);
});

test("bad lesson records are removed individually and prototype-like keys never become records", () => {
  const base = recordLesson(EMPTY_STATE, "depth", false, false, now);
  const record = base.lessons.depth;
  for (const attempts of [0, -1, 1.5, "3", Number.MAX_SAFE_INTEGER + 1]) {
    const parsed = parseSavedState(
      JSON.stringify({ ...base, lessons: { depth: { ...record, attempts } } }),
    );
    assert.deepEqual(parsed.lessons, {});
  }
  const raw = `{"version":1,"lessons":{"__proto__":{"polluted":true},"constructor":{},"motion":${JSON.stringify(record)},"depth":${JSON.stringify(record)}},"comparisons":[]}`;
  const parsed = parseSavedState(raw);
  assert.deepEqual(Object.keys(parsed.lessons), ["depth"]);
  assert.equal(Object.hasOwn(parsed.lessons, "__proto__"), false);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
  assert.deepEqual(
    recordLesson(EMPTY_STATE, "__proto__" as LessonId, true, true, now),
    EMPTY_STATE,
  );
});

test("invalid dates and booleans do not produce records; attempts cannot overflow a safe integer", () => {
  assert.deepEqual(
    recordLesson(EMPTY_STATE, "motion", false, false, "yesterday"),
    EMPTY_STATE,
  );
  assert.deepEqual(
    recordLesson(
      EMPTY_STATE,
      "motion",
      false,
      false,
      "2026-02-30T15:00:00.000Z",
    ),
    EMPTY_STATE,
  );
  const first = recordLesson(EMPTY_STATE, "motion", false, false, now);
  const poisoned = {
    ...first,
    lessons: { motion: { ...first.lessons.motion!, passed: "false" } },
  };
  assert.deepEqual(parseSavedState(JSON.stringify(poisoned)), EMPTY_STATE);
  first.lessons.motion!.attempts = Number.MAX_SAFE_INTEGER;
  assert.equal(
    recordLesson(first, "motion", false, false, later).lessons.motion?.attempts,
    Number.MAX_SAFE_INTEGER,
  );
});

test("new comparisons are newest first, capped at 20, and duplicate IDs are updated in place at the front", () => {
  let state: SavedState = parseSavedState(null);
  for (let index = 0; index < 30; index++)
    state = recordComparison(state, comparison({ id: `compare-${index}` }));
  assert.equal(state.comparisons.length, 20);
  assert.equal(state.comparisons[0].id, "compare-29");
  assert.equal(state.comparisons[19].id, "compare-10");
  const next = recordComparison(
    state,
    comparison({ id: "compare-15", preference: "unsure", createdAt: later }),
  );
  assert.equal(next.comparisons.length, 20);
  assert.equal(next.comparisons[0].id, "compare-15");
  assert.equal(next.comparisons[0].preference, "unsure");
  assert.equal(
    next.comparisons.filter((item) => item.id === "compare-15").length,
    1,
  );
  assert.equal(state.comparisons[0].id, "compare-29");
});

test("parser caps comparison records, rejects unknown enums and keeps valid neighbors", () => {
  const records = [
    comparison({ source: "remote" as CompareRecord["source"] }),
    comparison({ preference: "best" as CompareRecord["preference"] }),
    ...Array.from({ length: 35 }, (_, index) =>
      comparison({ id: `valid-${index}` }),
    ),
  ];
  const parsed = parseSavedState(
    JSON.stringify({ version: 1, lessons: {}, comparisons: records }),
  );
  assert.equal(parsed.comparisons.length, 20);
  assert.equal(parsed.comparisons[0].id, "valid-0");
  assert.equal(parsed.comparisons[19].id, "valid-19");
});

test("allowlist drops image, URL, metadata and token fields on parse and update", () => {
  const extra = {
    ...comparison(),
    image: "base64-sensitive",
    url: "blob:example",
    apiKey: "example-secret",
    metadata: { gps: "private" },
  };
  const state = {
    version: 1,
    lessons: {},
    comparisons: [extra],
    photos: ["private-photo"],
    token: "private-token",
  };
  const clean = parseSavedState(JSON.stringify(state));
  assert.deepEqual(clean.comparisons[0], comparison());
  assert.deepEqual(
    recordComparison(EMPTY_STATE, extra).comparisons[0],
    comparison(),
  );
  assert.doesNotMatch(JSON.stringify(clean), /base64|blob:|secret|gps|private/);
});

test("comparison text and IDs are bounded, URLs are rejected, and valid labels are trimmed", () => {
  for (const goal of [
    "",
    " ",
    "x".repeat(161),
    "https://example.test/photo.jpg",
    "data:image/png;base64,AA",
    "blob:private-photo",
    "file:///photo.jpg",
    "www.example.test",
    "a\nb",
  ]) {
    assert.equal(
      recordComparison(EMPTY_STATE, comparison({ goal })).comparisons.length,
      0,
    );
  }
  for (const id of [
    "",
    "x".repeat(101),
    "https://example.test",
    "blob:private",
    "id with space",
  ]) {
    assert.equal(
      recordComparison(EMPTY_STATE, comparison({ id })).comparisons.length,
      0,
    );
  }
  assert.equal(
    recordComparison(EMPTY_STATE, comparison({ goal: " 保留环境 " }))
      .comparisons[0].goal,
    "保留环境",
  );
});

test("preferences preserve user choice instead of treating retake as inherently better", () => {
  for (const preference of [
    "before",
    "after",
    "both",
    "unsure",
    "no-change",
  ] as const) {
    const state = recordComparison(EMPTY_STATE, comparison({ preference }));
    assert.equal(
      parseSavedState(JSON.stringify(state)).comparisons[0].preference,
      preference,
    );
    assert.ok(preferenceLabel(preference).length > 0);
  }
  assert.equal(preferenceLabel("before"), "更喜欢原图");
  assert.equal(preferenceLabel("unsure"), "暂时不确定");
  assert.equal(preferenceLabel("no-change"), "没有明显变化");
  assert.notEqual(preferenceLabel("no-change"), preferenceLabel("both"));
});
