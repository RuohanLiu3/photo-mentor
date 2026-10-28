import assert from "node:assert/strict";
import test from "node:test";
import {
  acceptCoachComparison,
  acceptCoachGuidance,
  beginCoachRequest,
  cancelCoachRequest,
  chooseCoachAdjustment,
  coachComparisonRecord,
  createCoachSession,
  fixtureComparison,
  fixtureGuidance,
  fixtureGuidanceProvider,
  hasAlternateCoachAction,
  parseCoachSession,
  patchCoachContext,
  patchCoachReason,
  SCENARIOS,
  selectCoachScenario,
  type CoachSession,
} from "../src/coaching.ts";

function advised(session = createCoachSession()): CoachSession {
  const next = beginCoachRequest(session, "guidance");
  return acceptCoachGuidance(
    next,
    fixtureGuidance(next.pending!, next.frame, next.context, next.alternate),
  );
}
function compared(
  session = advised(),
  variant: "adjusted" | "unchanged" = "adjusted",
): CoachSession {
  const next = beginCoachRequest(
    chooseCoachAdjustment(session, variant),
    "comparison",
  );
  return acceptCoachComparison(
    next,
    fixtureComparison(
      next.pending!,
      next.frame,
      next.afterFrame!,
      next.guidance!,
      next.context,
    ),
  );
}

test("target, style, device and frame changes invalidate late results without losing user context", () => {
  const pending = beginCoachRequest(createCoachSession(), "guidance");
  const result = fixtureGuidance(
    pending.pending!,
    pending.frame,
    pending.context,
  );
  for (const patch of [
    { goal: "environment" },
    { style: "light" },
    { device: "camera" },
    { lens: "my lens" },
  ] as const) {
    const changed = patchCoachContext(pending, patch);
    assert.equal(changed.contextVersion, pending.contextVersion + 1);
    assert.equal(acceptCoachGuidance(changed, result), changed);
    assert.equal(changed.guidance, null);
    assert.equal(changed.pending, null);
    assert.equal(changed.phase, "setup");
  }
  const changedFrame = selectCoachScenario(pending, "light");
  assert.equal(changedFrame.frame.scenarioId, "light");
  assert.equal(acceptCoachGuidance(changedFrame, result), changedFrame);
  assert.equal(patchCoachContext(pending, { goal: "portrait" }), pending);
});

test("cancellation and a newer request reject a late response even with the same frame and context", () => {
  const old = beginCoachRequest(createCoachSession(), "guidance");
  const result = fixtureGuidance(old.pending!, old.frame, old.context);
  const cancelled = cancelCoachRequest(old);
  assert.equal(cancelled.phase, "ready");
  assert.equal(acceptCoachGuidance(cancelled, result), cancelled);
  const retry = beginCoachRequest(cancelled, "guidance");
  assert.notEqual(retry.pending!.requestId, old.pending!.requestId);
  assert.equal(acceptCoachGuidance(retry, result), retry);
});

test("comparison rejects a stale before-frame identity and a response for another session", () => {
  const pending = beginCoachRequest(
    chooseCoachAdjustment(advised(), "adjusted"),
    "comparison",
  );
  const result = fixtureComparison(
    pending.pending!,
    pending.frame,
    pending.afterFrame!,
    pending.guidance!,
    pending.context,
  );
  assert.equal(
    acceptCoachComparison(pending, { ...result, beforeFrameId: "other-photo" }),
    pending,
  );
  assert.equal(
    acceptCoachComparison(pending, { ...result, sessionId: "other-session" }),
    pending,
  );
  const changed = patchCoachContext(pending, { constraint: "camera" });
  assert.equal(acceptCoachComparison(changed, result), changed);
  assert.equal(acceptCoachComparison(pending, result).phase, "compare");
});

test("refresh restores fixture progress and recovers interrupted work without pretending completion", () => {
  const complete = compared();
  const restored = parseCoachSession(JSON.stringify(complete));
  assert.equal(restored.phase, "compare");
  assert.equal(restored.frame.id, complete.frame.id);
  assert.equal(restored.afterFrame!.id, complete.afterFrame!.id);
  assert.equal(restored.guidance!.action, complete.guidance!.action);
  assert.equal(restored.comparison!.changes, complete.comparison!.changes);
  const loading = beginCoachRequest(createCoachSession(), "guidance");
  const recovered = parseCoachSession(JSON.stringify(loading));
  assert.equal(recovered.phase, "ready");
  assert.equal(recovered.pending, null);
  assert.match(recovered.notice!, /已恢复/);
  const comparisonLoading = beginCoachRequest(
    chooseCoachAdjustment(advised(), "unchanged"),
    "comparison",
  );
  const comparisonRecovered = parseCoachSession(
    JSON.stringify(comparisonLoading),
  );
  assert.equal(comparisonRecovered.phase, "adjust");
  assert.equal(comparisonRecovered.afterFrame!.variant, "unchanged");
  assert.equal(comparisonRecovered.comparison, null);
});

test("fixed camera and fixed subject restrictions are respected across all scenarios and alternative requests", () => {
  for (const scenario of SCENARIOS) {
    for (const alternate of [false, true]) {
      for (const constraint of ["camera", "subject"] as const) {
        const session = advised({
          ...selectCoachScenario(
            createCoachSession({ constraint, goal: scenario.goal }),
            scenario.id,
          ),
          alternate,
        });
        const action = session.guidance!;
        if (constraint === "camera") {
          assert.match(action.action, /保持手机机位/);
          assert.ok(
            ![
              "overlap-camera",
              "environment-wide",
              "environment-tight",
              "light-viewpoint",
            ].includes(action.actionId),
          );
        } else {
          assert.match(action.action, /保持人物位置/);
          assert.ok(
            !["overlap-subject", "environment-subject", "light-turn"].includes(
              action.actionId,
            ),
          );
        }
      }
    }
  }
});

test("the three fixtures expose distinct changes and unchanged input cannot produce an improvement claim", () => {
  const descriptions = new Set<string>();
  for (const scenario of SCENARIOS) {
    const session = advised(
      selectCoachScenario(
        createCoachSession({ goal: scenario.goal }),
        scenario.id,
      ),
    );
    const result = compared(session);
    assert.equal(result.comparison!.beforeFrameId, result.frame.id);
    assert.equal(result.comparison!.frameId, result.afterFrame!.id);
    assert.equal(result.afterFrame!.actionId, result.guidance!.actionId);
    assert.equal(result.comparison!.outcome, "changed");
    descriptions.add(result.comparison!.changes);
    const same = compared(session, "unchanged");
    assert.equal(same.comparison!.outcome, "unchanged");
    assert.match(same.comparison!.changes, /没有可观察到的变化/);
  }
  assert.equal(descriptions.size, 3);
});

test("user intent changes environment framing and style adds a relevant next check", () => {
  const context = selectCoachScenario(
    createCoachSession({ goal: "environment" }),
    "environment",
  );
  assert.equal(advised(context).guidance!.actionId, "environment-wide");
  assert.equal(
    advised(patchCoachContext(context, { goal: "portrait" })).guidance!
      .actionId,
    "environment-tight",
  );
  const withStyle = advised(createCoachSession({ style: "geometry" }));
  assert.match(withStyle.guidance!.nextCheck, /几何关系/);
});

test("saved judgments retain a stable id and preserve prefer-original, uncertainty and no-change", () => {
  const base = compared();
  for (const preference of [
    "before",
    "after",
    "both",
    "unsure",
    "no-change",
  ] as const) {
    const chosen = { ...base, preference, reason: "喜欢原来的空间感" };
    const first = coachComparisonRecord(chosen, "2026-09-27T10:00:00.000Z")!;
    const saved = {
      ...chosen,
      phase: "saved" as const,
      savedAt: first.createdAt,
    };
    const restored = parseCoachSession(JSON.stringify(saved));
    const second = coachComparisonRecord(restored, "2026-09-28T10:00:00.000Z")!;
    assert.deepEqual(second, first);
    assert.equal(first.preference, preference);
    assert.equal(first.reason, chosen.reason);
  }
  const fresh = createCoachSession(base.context);
  assert.notEqual(fresh.recordId, base.recordId);
  assert.equal(base.phase, "compare");
});

test("corrupt persistence never revives foreign frame evidence or stores embedded photos and unknown fields", () => {
  for (const raw of [null, "{", "[]", "null", " ".repeat(24_001)])
    assert.equal(parseCoachSession(raw).phase, "setup");
  const session = compared();
  const malicious = {
    ...session,
    context: {
      ...session.context,
      cameraBody: "data:image/png;base64,secret",
      lens: "https://private.test/p.jpg",
      gearId: "arbitrary-kit",
    },
    token: "private-secret",
    image: "base64-private",
    reason: "blob:private-photo",
    comparison: {
      ...session.comparison,
      changes: "invented success",
      imageUrl: "https://secret.test",
    },
  };
  const clean = parseCoachSession(JSON.stringify(malicious));
  assert.equal(clean.context.cameraBody, "");
  assert.equal(clean.context.lens, "");
  assert.equal(clean.context.gearId, null);
  assert.equal(clean.reason, "");
  assert.doesNotMatch(JSON.stringify(clean), /private|secret|base64|invented/);
  const wrongGuidance = parseCoachSession(
    JSON.stringify({
      ...session,
      guidance: { ...session.guidance, frameId: "different-frame" },
    }),
  );
  assert.equal(wrongGuidance.guidance, null);
  assert.equal(wrongGuidance.comparison, null);
  assert.equal(wrongGuidance.phase, "ready");
});

test("providers support actual abort and failure without producing a result", async () => {
  const next = beginCoachRequest(createCoachSession(), "guidance");
  const controller = new AbortController();
  const promise = fixtureGuidanceProvider.analyze(
    next.pending!,
    next.frame,
    next.context,
    false,
    controller.signal,
    "slow",
  );
  controller.abort();
  await assert.rejects(promise, { name: "AbortError" });
  await assert.rejects(
    fixtureGuidanceProvider.analyze(
      next.pending!,
      next.frame,
      next.context,
      false,
      new AbortController().signal,
      "failure",
    ),
    /示例加载没有完成/,
  );
});

test("URL-like input is sanitized before state can be persisted and alternate availability honors restrictions", () => {
  const initial = createCoachSession({
    cameraBody: "data:image/png;base64,secret",
    lens: "blob:private",
  });
  assert.equal(initial.context.cameraBody, "");
  assert.equal(initial.context.lens, "");
  const edited = patchCoachContext(initial, {
    cameraBody: "https://private.test",
    lens: "file:///private.jpg",
  });
  assert.equal(edited.context.cameraBody, "");
  assert.equal(edited.context.lens, "");
  assert.equal(
    patchCoachReason(edited, "data:image/png;base64,secret").reason,
    "",
  );
  assert.equal(
    hasAlternateCoachAction(
      advised(createCoachSession({ constraint: "camera" })),
    ),
    false,
  );
  assert.equal(hasAlternateCoachAction(advised(createCoachSession())), true);
});

test("portrait and landscape fixtures keep annotations normalized inside the corresponding image bounds", () => {
  for (const scenario of SCENARIOS) {
    const session = advised(
      selectCoachScenario(createCoachSession(), scenario.id),
    );
    assert.equal(
      session.frame.width < session.frame.height,
      scenario.id === "light",
    );
    const region = session.guidance!.annotation;
    assert.ok(region.x >= 0 && region.y >= 0);
    assert.ok(
      region.x + region.width <= 100 && region.y + region.height <= 100,
    );
    const after = chooseCoachAdjustment(session, "adjusted").afterFrame!;
    assert.equal(after.width, session.frame.width);
    assert.equal(after.height, session.frame.height);
  }
});

test("unreliable advice cannot advance into an adjustment or fabricated comparison", async () => {
  const pending = beginCoachRequest(createCoachSession(), "guidance");
  const result = await fixtureGuidanceProvider.analyze(
    pending.pending!,
    pending.frame,
    pending.context,
    false,
    new AbortController().signal,
    "unreliable",
  );
  const session = acceptCoachGuidance(pending, result);
  assert.equal(session.guidance!.reliable, false);
  assert.equal(chooseCoachAdjustment(session, "adjusted"), session);
  assert.equal(beginCoachRequest(session, "comparison"), session);
  assert.equal(coachComparisonRecord(session), null);
});
