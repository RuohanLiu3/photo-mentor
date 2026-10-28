import test from "node:test";
import assert from "node:assert/strict";
import {
  GEAR_KITS,
  createGearState,
  gearTotal,
  parseGearState,
  rankGearKits,
  sanitizeGearIds,
  toggleComparison,
} from "../src/gear.ts";

test("budget matching uses complete body and lens cost in the selected currency", () => {
  const q = createGearState().questionnaire;
  const matches = rankGearKits({ ...q, budget: "800" });
  assert.deepEqual(
    matches.map(({ kit }) => kit.id),
    ["demo-pocket"],
  );
  assert.equal(
    rankGearKits({ ...q, currency: "CNY", budget: "3799" }).length,
    0,
  );
  assert.equal(
    rankGearKits({ ...q, currency: "CNY", budget: "3800" })[0].kit.id,
    "demo-pocket",
  );
  for (const { kit } of rankGearKits({ ...q, budget: "1000" }))
    assert.ok(gearTotal(kit, "USD") <= 1000);
});

test("empty budget permits exploration and invalid budget never becomes unlimited", () => {
  const q = createGearState().questionnaire;
  assert.equal(rankGearKits({ ...q, budget: "" }).length, GEAR_KITS.length);
  for (const budget of ["0", "-5", "nope", "Infinity"])
    assert.equal(rankGearKits({ ...q, budget }).length, 0);
});

test("recommendation order responds to portrait, portability, and video priorities", () => {
  const q = { ...createGearState().questionnaire, budget: "" };
  assert.equal(
    rankGearKits({ ...q, subject: "portrait" })[0].kit.id,
    "demo-portrait",
  );
  assert.equal(
    rankGearKits({ ...q, subject: "travel", portable: "light" })[0].kit.id,
    "demo-pocket",
  );
  const video = rankGearKits({
    ...q,
    subject: "action",
    portable: "flexible",
    experience: "improving",
    video: "priority",
  });
  assert.equal(video[0].kit.id, "demo-hybrid");
  assert.ok(video[0].reasons.some((reason) => reason.includes("照片与视频")));
  assert.deepEqual(
    video,
    rankGearKits({
      ...q,
      subject: "action",
      portable: "flexible",
      experience: "improving",
      video: "priority",
    }),
  );
});

test("existing equipment never creates fabricated mount compatibility or discounts", () => {
  const q = createGearState().questionnaire;
  const baseline = rankGearKits(q);
  const existing = rankGearKits({ ...q, existing: "已有某品牌镜头" });
  assert.deepEqual(
    existing.map((match) => match.kit.id),
    baseline.map((match) => match.kit.id),
  );
  assert.ok(
    existing.every((match) =>
      match.considerations.some((note) => note.includes("尚未核对卡口")),
    ),
  );
});

test("comparison stays explicit, unique, reversible, and capped at three", () => {
  let ids: string[] = [];
  for (const kit of GEAR_KITS) ids = toggleComparison(ids, kit.id);
  assert.equal(ids.length, 3);
  assert.deepEqual(toggleComparison(ids, "unknown"), ids);
  const removed = toggleComparison(ids, ids[0]);
  assert.equal(removed.length, 2);
  assert.equal(toggleComparison(removed, GEAR_KITS[3].id).length, 3);
  assert.deepEqual(sanitizeGearIds([ids[0], ids[0], 3, "bad", ids[1]]), [
    ids[0],
    ids[1],
  ]);
});

test("persistence restores entered needs, detail and comparison without ownership", () => {
  const original = createGearState();
  original.questionnaire.subject = "portrait";
  original.questionnaire.currency = "CNY";
  original.questionnaire.budget = "6000";
  original.questionnaire.existing = "我的手机";
  original.step = "detail";
  original.detailId = "demo-portrait";
  original.comparedIds = ["demo-pocket", "demo-portrait"];
  const restored = parseGearState(JSON.stringify(original));
  assert.deepEqual(restored, original);
  assert.equal("owned" in restored, false);
  assert.equal("favorites" in restored, false);
});

test("corrupt, oversized and future state falls back safely", () => {
  for (const raw of [
    null,
    "{",
    "null",
    "[]",
    JSON.stringify({ version: 2 }),
    " ".repeat(24_001),
  ])
    assert.deepEqual(parseGearState(raw), createGearState());
  const restored = parseGearState(
    JSON.stringify({
      version: 1,
      questionnaire: {
        currency: "bad",
        budget: "9999999",
        subject: "injected",
        existing: "x".repeat(900),
        video: {},
      },
      step: "detail",
      detailId: "missing",
      comparedIds: [...GEAR_KITS.map((kit) => kit.id), "missing"],
    }),
  );
  assert.equal(restored.questionnaire.currency, "USD");
  assert.equal(restored.questionnaire.budget, "1000000");
  assert.equal(restored.questionnaire.existing.length, 160);
  assert.equal(restored.questionnaire.subject, "everyday");
  assert.equal(restored.questionnaire.video, "occasionally");
  assert.equal(restored.detailId, null);
  assert.equal(restored.step, "results");
  assert.equal(restored.comparedIds.length, 3);
});

test("all fictional kits use the available teaching profile and full budget definitions", () => {
  for (const kit of GEAR_KITS) {
    assert.equal(kit.profileId, "generic-v1");
    assert.match(kit.body, /教学/);
    assert.match(kit.lens, /教学/);
    assert.ok(kit.strengths.length && kit.tradeoffs.length);
    for (const currency of ["USD", "CNY"] as const)
      assert.ok(kit.budget[currency].body > 0 && kit.budget[currency].lens > 0);
  }
});
