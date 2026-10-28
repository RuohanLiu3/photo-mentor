import test from "node:test";
import assert from "node:assert/strict";
import {
  COACH_KEY,
  GEAR_KEY,
  PROFILE_KEY,
  SIMULATOR_KEY,
  LOCAL_DATA_KEYS,
  activeNav,
  clearLocalData,
  createProfile,
  parseProfile,
  profileEquipmentContext,
  reconcileProfileDraft,
  routeFromHash,
  toggleProfileKit,
  startSimulatorLesson,
} from "../src/framework.ts";
import { GEAR_KITS } from "../src/gear.ts";
import { createSimulatorState } from "../src/simulator.ts";
import {
  STORAGE_KEY,
  parseSavedState,
  isValidComparisonGoal,
  normalizeComparisonRecord,
  recordComparison,
  recordLesson,
} from "../src/storage.ts";
import type { CompareRecord } from "../src/storage.ts";

test("profile persistence retains user equipment, independent collections and explicit default", () => {
  const original = {
    ...createProfile(),
    device: "camera" as const,
    cameraBody: "我的机身",
    lens: "我的 35mm 镜头",
    favorites: ["demo-portrait"],
    owned: ["demo-pocket"],
    defaultGearId: "demo-pocket",
  };
  assert.deepEqual(parseProfile(JSON.stringify(original)), original);
  assert.equal(
    new Set([STORAGE_KEY, PROFILE_KEY, COACH_KEY, GEAR_KEY, SIMULATOR_KEY])
      .size,
    5,
  );
  assert.equal(STORAGE_KEY, "frame-mentor-v1");
});

test("favoriting a recommendation never implies ownership or changes the default", () => {
  const original = createProfile();
  const favorite = toggleProfileKit(original, "favorites", "demo-portrait");
  assert.deepEqual(favorite.favorites, ["demo-portrait"]);
  assert.deepEqual(favorite.owned, []);
  assert.equal(favorite.defaultGearId, null);
  assert.deepEqual(original, createProfile());
  const owner = toggleProfileKit(favorite, "owned", "demo-pocket");
  assert.deepEqual(owner.favorites, ["demo-portrait"]);
  assert.deepEqual(owner.owned, ["demo-pocket"]);
  assert.equal(owner.defaultGearId, null);
  const unfavorite = toggleProfileKit(owner, "favorites", "demo-portrait");
  assert.deepEqual(unfavorite.favorites, []);
  assert.deepEqual(unfavorite.owned, ["demo-pocket"]);
  assert.deepEqual(toggleProfileKit(owner, "owned", "unlisted"), owner);
});

test("removing owned default clears it without removing an independent favorite", () => {
  const original = {
    ...createProfile(),
    owned: ["demo-pocket", "demo-portrait"],
    favorites: ["demo-pocket"],
    defaultGearId: "demo-pocket",
  };
  const otherRemoved = toggleProfileKit(original, "owned", "demo-portrait");
  assert.equal(otherRemoved.defaultGearId, "demo-pocket");
  const defaultRemoved = toggleProfileKit(original, "owned", "demo-pocket");
  assert.equal(defaultRemoved.defaultGearId, null);
  assert.deepEqual(defaultRemoved.favorites, ["demo-pocket"]);
  assert.deepEqual(defaultRemoved.owned, ["demo-portrait"]);
  assert.equal(original.defaultGearId, "demo-pocket");
  assert.equal(
    parseProfile(JSON.stringify({ ...original, owned: [] })).defaultGearId,
    null,
  );
});

test("profile parser bounds input and discards unknown IDs and untrusted extra fields", () => {
  for (const raw of [
    null,
    "{",
    "[]",
    "null",
    "42",
    JSON.stringify({ version: 2 }),
    " ".repeat(12001),
  ]) {
    assert.deepEqual(parseProfile(raw), createProfile());
  }
  const result = parseProfile(
    JSON.stringify({
      ...createProfile(),
      device: "remote",
      cameraBody: "x".repeat(101),
      lens: "  我的变焦镜头  ",
      favorites: ["demo-pocket", "demo-pocket", "unknown", null],
      owned: [...GEAR_KITS.map((kit) => kit.id), "unknown"],
      defaultGearId: "unknown",
      photos: ["sensitive photo"],
      apiKey: "sensitive key",
    }),
  );
  assert.equal(result.device, "phone");
  assert.equal(result.cameraBody, "");
  assert.equal(result.lens, "我的变焦镜头");
  assert.deepEqual(result.favorites, ["demo-pocket"]);
  assert.equal(result.owned.length, GEAR_KITS.length);
  assert.equal(result.defaultGearId, null);
  assert.doesNotMatch(JSON.stringify(result), /sensitive|photos|apiKey/);
});

test("profile equipment text never retains URLs, photo payloads or control characters", () => {
  for (const value of [
    "https://example.test/photo.jpg",
    "data:image/png;base64,AA",
    "blob:private-photo",
    "file:///photo.jpg",
    "javascript:photo",
    "ftp://example.test/photo.jpg",
    "www.example.test",
    "a\nb",
    "a\u007fb",
  ]) {
    const parsed = parseProfile(
      JSON.stringify({ ...createProfile(), cameraBody: value, lens: value }),
    );
    assert.equal(parsed.cameraBody, "", value);
    assert.equal(parsed.lens, "", value);
  }
});

test("all existing shared routes remain addressable and map to the five-tab navigation", () => {
  for (const path of [
    "/",
    "/learn",
    "/lesson/motion",
    "/lesson/depth",
    "/lesson/composition",
    "/coach",
    "/styles",
    "/journal",
  ]) {
    assert.equal(routeFromHash(`#${path}`), path);
    assert.equal(routeFromHash(`#${path}?reference=old-link`), path);
  }
  assert.equal(routeFromHash("#/records"), "/journal");
  assert.equal(routeFromHash("#/equipment"), "/gear");
  assert.equal(routeFromHash("#/simulate"), "/simulator");
  assert.equal(activeNav("/simulator"), "/learn");
  assert.equal(activeNav("/styles"), "/learn");
  assert.equal(activeNav("/lesson/depth"), "/learn");
  assert.equal(activeNav("/photos"), "/coach");
});

test("unknown hash paths always return a string route instead of prototype properties", () => {
  for (const hash of [
    "",
    "#",
    "#/unknown",
    "#/lesson/unknown",
    "#constructor",
    "#__proto__",
    "#toString",
    "#javascript:alert(1)",
  ]) {
    const route = routeFromHash(hash);
    assert.equal(route, "/", hash);
    assert.doesNotThrow(() => activeNav(route));
  }
});

test("new optional comparison fields retain old v1 records and lesson history", () => {
  const timestamp = "2026-09-27T12:00:00.000Z";
  const oldRecord: CompareRecord = {
    id: "legacy-compare",
    source: "demo",
    preference: "before",
    goal: "保留环境",
    createdAt: timestamp,
  };
  const base = recordLesson(
    parseSavedState(null),
    "depth",
    true,
    true,
    timestamp,
  );
  const old = recordComparison(base, oldRecord);
  const latest = recordComparison(old, {
    ...oldRecord,
    id: "new-compare",
    reason: " 更喜欢原来的环境关系。 ",
    scenarioId: "environment",
  });
  const restored = parseSavedState(JSON.stringify(latest));
  assert.deepEqual(restored.lessons, old.lessons);
  assert.deepEqual(restored.comparisons[1], oldRecord);
  assert.equal(restored.comparisons[0].reason, "更喜欢原来的环境关系。");
  assert.equal(restored.comparisons[0].scenarioId, "environment");
});

test("unsafe optional metadata is dropped without discarding a valid historical judgment", () => {
  const record: CompareRecord = {
    id: "legacy-personal",
    source: "personal",
    preference: "unsure",
    goal: "观察构图",
    createdAt: "2026-09-27T12:00:00.000Z",
    reason: "blob:private-image",
    scenarioId: "environment",
  };
  const restored = recordComparison(parseSavedState(null), record);
  assert.equal(restored.comparisons.length, 1);
  assert.equal(restored.comparisons[0].reason, undefined);
  assert.equal(restored.comparisons[0].scenarioId, undefined);
  assert.equal(restored.comparisons[0].preference, "unsure");
});

test("profile kit context supplies teaching labels and preserves explicit personal equipment and phone preference", () => {
  const profile = {
    ...createProfile(),
    owned: ["demo-pocket"],
    defaultGearId: "demo-pocket",
  };
  const kit = GEAR_KITS.find((kit) => kit.id === "demo-pocket")!;
  const context = profileEquipmentContext(profile);
  assert.equal(context.device, "phone");
  assert.equal(context.gearId, kit.id);
  assert.equal(context.cameraBody, kit.body);
  assert.equal(context.lens, kit.lens);
  const custom = profileEquipmentContext({
    ...profile,
    device: "camera",
    cameraBody: "自己的机身",
    lens: "自己的镜头",
  });
  assert.equal(custom.device, "camera");
  assert.equal(custom.cameraBody, "自己的机身");
  assert.equal(custom.lens, "自己的镜头");
  assert.equal(profile.cameraBody, "");
  const noLongerOwned = profileEquipmentContext({ ...profile, owned: [] });
  assert.equal(noLongerOwned.gearId, null);
  assert.equal(noLongerOwned.cameraBody, "");
});

test("removing the draft default does not overwrite unrelated unsaved form edits", () => {
  const draft = {
    ...createProfile(),
    device: "camera" as const,
    defaultGearId: "demo-pocket",
    cameraBody: "还没有保存的新机身",
    lens: "新镜头",
  };
  const unchanged = reconcileProfileDraft(draft, ["demo-pocket"]);
  assert.equal(unchanged, draft);
  const cleared = reconcileProfileDraft(draft, []);
  assert.equal(cleared.defaultGearId, null);
  assert.equal(cleared.cameraBody, draft.cameraBody);
  assert.equal(cleared.lens, draft.lens);
  assert.equal(cleared.device, "camera");
  assert.equal(draft.defaultGearId, "demo-pocket");
});

test("clearing known local state removes old records and lesson drafts without touching unrelated storage", () => {
  const values = new Map<string, string>(
    LOCAL_DATA_KEYS.map((key) => [key, "private record"]),
  );
  values.set("another-app", "keep");
  const result = clearLocalData({
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
  });
  assert.equal(result.cleared, true);
  assert.deepEqual(result.failedKeys, []);
  assert.deepEqual([...values.entries()], [["another-app", "keep"]]);
  assert.ok(LOCAL_DATA_KEYS.includes("frame-lesson-motion-v1"));
  assert.ok(LOCAL_DATA_KEYS.includes("frame-lesson-depth-v1"));
  assert.ok(LOCAL_DATA_KEYS.includes("frame-lesson-composition-v1"));
});

test("clear status reports failures and still attempts every remaining key", () => {
  const attempted: string[] = [];
  const result = clearLocalData({
    removeItem: (key) => {
      attempted.push(key);
      if (key === PROFILE_KEY) throw new Error("blocked");
    },
    getItem: (key) =>
      key === PROFILE_KEY || key === GEAR_KEY ? "still retained" : null,
  });
  assert.equal(result.cleared, false);
  assert.deepEqual(result.failedKeys, [PROFILE_KEY, GEAR_KEY]);
  assert.deepEqual(attempted, [...LOCAL_DATA_KEYS]);
  assert.equal(clearLocalData(null).cleared, false);
});

test("form goal validation matches accepted records before claiming a manual comparison is saved", () => {
  for (const goal of [
    "构图",
    " 保留环境 ",
    "www.example.test",
    "javascript:photo",
    "ftp://example.test/photo",
    "a\nb",
    "",
    "x".repeat(161),
  ]) {
    const candidate = {
      id: "manual-01",
      source: "personal",
      preference: "before",
      goal,
      createdAt: "2026-09-27T12:00:00.000Z",
    };
    assert.equal(
      isValidComparisonGoal(goal),
      normalizeComparisonRecord(candidate) !== null,
      goal,
    );
  }
});

test("entering simulator from a different lesson resets only that task's hint flag and preserves evidence signature", () => {
  const original = {
    ...createSimulatorState(),
    lessonId: "motion" as const,
    taskHintSeen: true,
    lastRecordedSignature: "previous-check",
    completedTasks: ["motion" as const],
  };
  const same = startSimulatorLesson(original, "motion");
  assert.equal(same.activity, "task");
  assert.equal(same.taskHintSeen, true);
  const different = startSimulatorLesson(original, "depth");
  assert.equal(different.lessonId, "depth");
  assert.equal(different.taskHintSeen, false);
  assert.equal(different.lastRecordedSignature, "previous-check");
  assert.deepEqual(different.completedTasks, ["motion"]);
  assert.equal(original.lessonId, "motion");
  assert.equal(original.taskHintSeen, true);
});
