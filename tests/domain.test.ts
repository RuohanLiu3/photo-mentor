import test from "node:test";
import assert from "node:assert/strict";
import {
  APERTURES,
  DEFAULT_SIM,
  ISOS,
  SHUTTERS,
  exposureDelta,
  evaluateLesson,
  getDemoGuidance,
} from "../src/domain.ts";
import type { DemoGuidanceOptions, SimSettings } from "../src/domain.ts";

const settings = (overrides: Partial<SimSettings> = {}): SimSettings => ({
  ...DEFAULT_SIM,
  ...overrides,
});
const options = (
  overrides: Partial<DemoGuidanceOptions> = {},
): DemoGuidanceOptions => ({
  device: "phone",
  goal: "portrait",
  depth: "simple",
  style: "none",
  strategy: "subject",
  constraint: "none",
  ...overrides,
});

test("reference exposure is zero and equivalent full-stop combinations retain brightness", () => {
  assert.equal(exposureDelta(settings()), 0);
  assert.equal(
    exposureDelta(settings({ shutterIndex: 4, apertureIndex: 0 })),
    0,
  );
  assert.equal(exposureDelta(settings({ shutterIndex: 4, isoIndex: 3 })), 0);
  assert.equal(exposureDelta(settings({ apertureIndex: 3, isoIndex: 2 })), 0);
});

test("aperture uses exact stops despite rounded f/2.8 and f/5.6 labels", () => {
  assert.equal(exposureDelta(settings({ apertureIndex: 1 })), 1);
  assert.equal(exposureDelta(settings({ apertureIndex: 3 })), -1);
  assert.notEqual(Math.log2((4 / 2.8) ** 2), 1);
});

test("each control has the intended brightness direction and nominal shutter timing is respected", () => {
  assert.equal(exposureDelta(settings({ shutterIndex: 3 })), -1);
  assert.equal(exposureDelta(settings({ apertureIndex: 1 })), 1);
  assert.equal(exposureDelta(settings({ isoIndex: 2 })), 1);
  assert.ok(
    Math.abs(
      exposureDelta(settings({ shutterIndex: 1 })) - Math.log2(125 / 60),
    ) < 1e-12,
  );
});

test("corrupted persisted values remain finite and do not mutate the supplied state", () => {
  const bad = settings({
    shutterIndex: NaN,
    apertureIndex: Infinity,
    isoIndex: -Infinity,
    viewpoint: NaN,
  });
  assert.equal(exposureDelta(bad), 0);
  assert.equal(evaluateLesson("motion", bad).passed, false);
  assert.ok(Number.isNaN(bad.shutterIndex));
  assert.ok(
    Number.isFinite(
      exposureDelta(
        settings({ shutterIndex: 99, apertureIndex: -30, isoIndex: 1.25 }),
      ),
    ),
  );
});

test("motion goal requires both clear motion and target brightness", () => {
  assert.equal(evaluateLesson("motion", settings()).passed, false);
  assert.equal(
    evaluateLesson("motion", settings({ shutterIndex: 4 })).passed,
    false,
  );
  assert.equal(
    evaluateLesson("motion", settings({ shutterIndex: 4, isoIndex: 3 })).passed,
    true,
  );
  assert.equal(
    evaluateLesson("motion", settings({ shutterIndex: 5, isoIndex: 4 })).passed,
    true,
  );
  assert.equal(
    evaluateLesson(
      "motion",
      settings({ shutterIndex: 4, apertureIndex: 0, isoIndex: 4 }),
    ).passed,
    false,
  );
});

test("brightness alone cannot pass a motion exercise at any slow shutter speed", () => {
  for (let shutterIndex = 0; shutterIndex < 4; shutterIndex++) {
    for (
      let apertureIndex = 0;
      apertureIndex < APERTURES.length;
      apertureIndex++
    ) {
      for (let isoIndex = 0; isoIndex < ISOS.length; isoIndex++) {
        assert.equal(
          evaluateLesson(
            "motion",
            settings({ shutterIndex, apertureIndex, isoIndex }),
          ).passed,
          false,
        );
      }
    }
  }
});

test("depth outcome follows user intent and compensated exercise ignores ISO and shutter", () => {
  const shallow = settings({ apertureIndex: 0 });
  assert.equal(evaluateLesson("depth", shallow).passed, true);
  assert.equal(
    evaluateLesson("depth", { ...shallow, depthGoal: "context" }).passed,
    false,
  );
  const deep = settings({ apertureIndex: 4, depthGoal: "context" });
  assert.equal(evaluateLesson("depth", deep).passed, true);
  for (let shutterIndex = 0; shutterIndex < SHUTTERS.length; shutterIndex++) {
    assert.equal(
      evaluateLesson("depth", { ...deep, shutterIndex, isoIndex: 0 }).passed,
      true,
    );
  }
});

test("composition has different outcomes for subject and environment intentions", () => {
  assert.equal(evaluateLesson("composition", settings()).passed, false);
  assert.equal(
    evaluateLesson("composition", settings({ viewpoint: 1 })).passed,
    true,
  );
  assert.equal(
    evaluateLesson(
      "composition",
      settings({ viewpoint: 1, depthGoal: "context" }),
    ).passed,
    false,
  );
  assert.equal(
    evaluateLesson(
      "composition",
      settings({ viewpoint: 2, depthGoal: "context" }),
    ).passed,
    true,
  );
});

test("goal, selected strategy and style change meaningful parts of demo guidance", () => {
  const base = getDemoGuidance(options());
  assert.notEqual(
    base.actions[1].body,
    getDemoGuidance(options({ goal: "environment" })).actions[1].body,
  );
  assert.notEqual(
    base.actions[0].body,
    getDemoGuidance(options({ strategy: "context" })).actions[0].body,
  );
  assert.notEqual(
    base.actions[1].body,
    getDemoGuidance(options({ style: "light" })).actions[1].body,
  );
  assert.notEqual(
    base.title,
    getDemoGuidance(options({ depth: "explore", strategy: "context" })).title,
  );
});

test("fixed-camera guidance never directs the photographer to move camera position", () => {
  for (const goal of ["portrait", "environment", "creative"] as const) {
    for (const style of ["none", "geometry", "environment", "light"] as const) {
      const guidance = getDemoGuidance(
        options({ goal, style, constraint: "camera" }),
      );
      assert.match(
        guidance.actions[0].body,
        /保持相机位置|保持机位|人物小幅侧移/,
      );
      assert.doesNotMatch(
        guidance.actions.map((item) => item.body).join(" "),
        /后退|侧移相机|横移机位|改变机位/,
      );
    }
  }
});

test("fixed-subject guidance does not ask the subject to move or turn", () => {
  for (const style of ["none", "geometry", "environment", "light"] as const) {
    const guidance = getDemoGuidance(options({ style, constraint: "subject" }));
    assert.match(guidance.actions[0].body, /保持人物位置/);
    assert.doesNotMatch(
      guidance.actions.map((item) => item.body).join(" "),
      /请人物|调整站位/,
    );
  }
});

test("phone and unknown equipment get no physical aperture instruction or fabricated EXIF", () => {
  for (const device of ["phone", "unknown"] as const) {
    for (const style of ["none", "geometry", "environment", "light"] as const) {
      const guidance = getDemoGuidance(options({ device, style }));
      const visible = JSON.stringify(guidance);
      assert.doesNotMatch(
        visible,
        /开大光圈|收小光圈|f\/[0-9]|ISO ?[0-9]|1\/\d+ 秒/,
      );
      assert.match(guidance.deviceNote, /没有/);
    }
  }
});

test("demo guidance stays explicit and bounded to two actions", () => {
  const guidance = getDemoGuidance(options());
  assert.match(guidance.title, /示例/);
  assert.equal(guidance.actions.length, 2);
  assert.notEqual(guidance.actions[0].id, guidance.actions[1].id);
  assert.match(guidance.actions[0].body, /示例/);
  assert.ok(
    guidance.actions.every(
      (action) => action.reason.length > 0 && action.tradeoff.length > 0,
    ),
  );
});
