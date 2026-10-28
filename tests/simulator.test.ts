import test from "node:test";
import assert from "node:assert/strict";
import { APERTURES, ISOS, SHUTTERS, exposureDelta } from "../src/domain.ts";
import {
  CAMERA_PROFILES,
  checkSimulatorTask,
  createSimulatorState,
  parseSimulatorState,
  resolveExposureMode,
  simulatorGoal,
  simulatorSignature,
  updateSimulatorParameter,
} from "../src/simulator.ts";

test("manual mode changes only the selected parameter and does not mutate the caller", () => {
  const before = createSimulatorState();
  const after = updateSimulatorParameter(before, "shutterIndex", 4);
  assert.equal(before.settings.shutterIndex, 2);
  assert.deepEqual(after.settings, { ...before.settings, shutterIndex: 4 });
  assert.equal(exposureDelta(after.settings), -2);
});

test("aperture priority compensates with shutter and keeps ISO manual", () => {
  const state = { ...createSimulatorState(), mode: "A" as const };
  const after = updateSimulatorParameter(state, "apertureIndex", 0);
  assert.equal(after.settings.apertureIndex, 0);
  assert.equal(after.settings.shutterIndex, 4);
  assert.equal(after.settings.isoIndex, state.settings.isoIndex);
  assert.equal(exposureDelta(after.settings), 0);
  assert.equal(updateSimulatorParameter(after, "shutterIndex", 1), after);
});

test("shutter priority compensates with aperture and ignores writes to the auto parameter", () => {
  const state = { ...createSimulatorState(), mode: "S" as const };
  const after = updateSimulatorParameter(state, "shutterIndex", 4);
  assert.equal(after.settings.apertureIndex, 0);
  assert.equal(exposureDelta(after.settings), 0);
  assert.equal(updateSimulatorParameter(after, "apertureIndex", 4), after);
});

test("auto modes never invent unavailable values and choose the smallest attainable exposure error", () => {
  for (const mode of ["A", "S"] as const) {
    for (let shutterIndex = 0; shutterIndex < SHUTTERS.length; shutterIndex++) {
      for (
        let apertureIndex = 0;
        apertureIndex < APERTURES.length;
        apertureIndex++
      ) {
        for (let isoIndex = 0; isoIndex < ISOS.length; isoIndex++) {
          const settings = {
            ...createSimulatorState().settings,
            shutterIndex,
            apertureIndex,
            isoIndex,
          };
          const resolved = resolveExposureMode(settings, mode);
          assert.equal(resolved.isoIndex, isoIndex);
          const automatic = mode === "A" ? "shutterIndex" : "apertureIndex";
          const length = mode === "A" ? SHUTTERS.length : APERTURES.length;
          assert.ok(resolved[automatic] >= 0 && resolved[automatic] < length);
          for (let alternative = 0; alternative < length; alternative++) {
            assert.ok(
              Math.abs(exposureDelta(resolved)) <=
                Math.abs(
                  exposureDelta({ ...resolved, [automatic]: alternative }),
                ) +
                  1e-12,
            );
          }
        }
      }
    }
  }
});

test("range exhaustion keeps a visible exposure mismatch instead of pretending successful metering", () => {
  const state = { ...createSimulatorState(), mode: "S" as const };
  const after = updateSimulatorParameter(state, "shutterIndex", 5);
  assert.equal(after.settings.apertureIndex, 0);
  assert.equal(exposureDelta(after.settings), -1);
  assert.equal(after.settings.isoIndex, 1);
});

test("saved task and device context round trip without accepting fictional real profiles", () => {
  const state = {
    ...createSimulatorState(),
    gearId: "demo-travel",
    requestedModel: "My camera",
    activity: "task" as const,
    lessonId: "depth" as const,
    completedTasks: ["motion" as const],
    taskHintSeen: true,
    grid: true,
  };
  state.lastRecordedSignature = simulatorSignature(state);
  assert.deepEqual(parseSimulatorState(JSON.stringify(state)), state);
  const unverified = parseSimulatorState(
    JSON.stringify({
      ...state,
      profileId: "unverified-brand",
      metadata: { verified: true },
    }),
  );
  assert.equal(unverified.profileId, "generic-v1");
  assert.equal("metadata" in unverified, false);
  assert.equal(CAMERA_PROFILES.length, 1);
  assert.equal(CAMERA_PROFILES[0].source, "teaching");
});

test("corrupt and oversized persistence is bounded and unsafe or unknown IDs are rejected", () => {
  for (const raw of [
    null,
    "not-json",
    "null",
    "[]",
    '{"version":9}',
    " ".repeat(20001),
  ]) {
    assert.deepEqual(parseSimulatorState(raw), createSimulatorState());
  }
  const parsed = parseSimulatorState(
    JSON.stringify({
      version: 1,
      gearId: "https://example.com/evil",
      mode: "AUTO",
      activity: "cheat",
      lessonId: "unknown",
      bodyView: "front",
      hotspotId: "screen",
      settings: {
        shutterIndex: 999,
        apertureIndex: -90,
        isoIndex: 1.7,
        viewpoint: "2",
        depthGoal: "fake",
      },
      completedTasks: ["motion", "motion", "unverified"],
      requestedModel: "x".repeat(200),
      grid: "true",
      showAdvanced: 1,
      lastRecordedSignature: "x".repeat(200),
    }),
  );
  assert.equal(parsed.gearId, null);
  assert.equal(parsed.mode, "M");
  assert.equal(parsed.activity, "free");
  assert.equal(parsed.lessonId, "motion");
  assert.equal(parsed.settings.shutterIndex, SHUTTERS.length - 1);
  assert.equal(parsed.settings.apertureIndex, 0);
  assert.equal(parsed.settings.isoIndex, 2);
  assert.equal(parsed.settings.viewpoint, 0);
  assert.deepEqual(parsed.completedTasks, ["motion"]);
  assert.equal(parsed.requestedModel.length, 80);
  assert.equal(parsed.grid, false);
  assert.equal(parsed.showAdvanced, false);
  assert.equal(parsed.lastRecordedSignature, null);
  assert.ok(
    CAMERA_PROFILES[0].hotspots.find(
      (hotspot) => hotspot.id === parsed.hotspotId,
    )?.locations.front,
  );
});

test("restoring priority mode recalculates corrupted auto values and preserves the chosen goal", () => {
  const original = {
    ...createSimulatorState(),
    mode: "A",
    settings: {
      ...createSimulatorState().settings,
      apertureIndex: 0,
      shutterIndex: 0,
      depthGoal: "context",
    },
  };
  const restored = parseSimulatorState(JSON.stringify(original));
  assert.equal(restored.settings.shutterIndex, 4);
  assert.equal(exposureDelta(restored.settings), 0);
  assert.equal(simulatorGoal(restored), "environment");
  assert.equal(simulatorGoal(createSimulatorState()), "portrait");
});

test("parameter edits retain evidence and produce a different check signature", () => {
  const state = {
    ...createSimulatorState(),
    completedTasks: ["motion" as const],
    taskHintSeen: true,
    lastRecordedSignature: "old",
  };
  const after = updateSimulatorParameter(state, "isoIndex", 4);
  assert.equal(after.lastRecordedSignature, "old");
  assert.equal(after.taskHintSeen, true);
  assert.deepEqual(after.completedTasks, ["motion"]);
  assert.notEqual(simulatorSignature(after), simulatorSignature(state));
});

test("rechecking unchanged parameters, mode, or reopened hint does not duplicate attempts", () => {
  const state = createSimulatorState();
  const first = checkSimulatorTask(state);
  assert.equal(first.record, true);
  assert.equal(first.feedback.passed, false);
  assert.equal(checkSimulatorTask(first.state).record, false);
  const unchanged = updateSimulatorParameter(
    first.state,
    "shutterIndex",
    first.state.settings.shutterIndex,
  );
  assert.equal(checkSimulatorTask(unchanged).record, false);
  const helped = checkSimulatorTask({ ...unchanged, taskHintSeen: true });
  assert.equal(helped.record, true);
  assert.equal(
    checkSimulatorTask({ ...helped.state, taskHintSeen: true }).record,
    false,
  );
  assert.equal(
    checkSimulatorTask(parseSimulatorState(JSON.stringify(helped.state)))
      .record,
    false,
  );
});

test("completed tasks require an explicit successful check and remain evidence after later failed attempts", () => {
  const state = createSimulatorState();
  const clear = updateSimulatorParameter(state, "shutterIndex", 4);
  const balanced = updateSimulatorParameter(clear, "isoIndex", 3);
  assert.deepEqual(balanced.completedTasks, []);
  const checked = checkSimulatorTask(balanced);
  assert.equal(checked.feedback.passed, true);
  assert.deepEqual(checked.state.completedTasks, ["motion"]);
  const later = checkSimulatorTask(
    updateSimulatorParameter(checked.state, "isoIndex", 0),
  );
  assert.equal(later.record, true);
  assert.equal(later.feedback.passed, false);
  assert.deepEqual(later.state.completedTasks, ["motion"]);
});
