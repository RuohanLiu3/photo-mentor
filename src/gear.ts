export type GearCurrency = "USD" | "CNY";
export type GearSubject = "everyday" | "portrait" | "travel" | "action";
export type GearPortability = "light" | "balanced" | "flexible";
export type GearExperience = "first" | "improving";
export type GearVideo = "occasionally" | "regularly" | "priority";

export interface GearQuestionnaire {
  currency: GearCurrency;
  budget: string;
  subject: GearSubject;
  portable: GearPortability;
  experience: GearExperience;
  video: GearVideo;
  existing: string;
}

export interface GearKit {
  id: string;
  name: string;
  body: string;
  lens: string;
  profileId: "generic-v1";
  tagline: string;
  accent: "sand" | "clay" | "forest" | "slate";
  icon: "everyday" | "portrait" | "travel" | "video";
  subjects: GearSubject[];
  portable: GearPortability;
  beginnerFriendly: boolean;
  video: number;
  budget: Record<GearCurrency, { body: number; lens: number }>;
  strengths: string[];
  tradeoffs: string[];
  practice: string;
}

/** Fictional teaching configurations. Amounts only exercise the budget flow. */
export const GEAR_KITS: GearKit[] = [
  {
    id: "demo-pocket",
    name: "轻装日常套装",
    body: "轻便机身 · 教学款 A",
    lens: "轻便变焦镜头 · 教学款",
    profileId: "generic-v1",
    tagline: "让愿意随身带着，比参数多一点更重要。",
    accent: "sand",
    icon: "everyday",
    subjects: ["everyday", "travel"],
    portable: "light",
    beginnerFriendly: true,
    video: 1,
    budget: { USD: { body: 350, lens: 200 }, CNY: { body: 2400, lens: 1400 } },
    strengths: ["教学设定侧重轻装出门", "一支变焦镜头练习不同取景范围"],
    tradeoffs: [
      "不以远距离运动或专业视频为重点",
      "镜头选择的自由度在本例中较少",
    ],
    practice: "从构图练习开始，观察同一场景的不同表达。",
  },
  {
    id: "demo-portrait",
    name: "人物表达套装",
    body: "基础机身 · 教学款 B",
    lens: "人像定焦镜头 · 教学款",
    profileId: "generic-v1",
    tagline: "把更多预算留给镜头和观察人物的时间。",
    accent: "clay",
    icon: "portrait",
    subjects: ["portrait", "everyday"],
    portable: "balanced",
    beginnerFriendly: true,
    video: 1,
    budget: { USD: { body: 450, lens: 400 }, CNY: { body: 3100, lens: 2700 } },
    strengths: [
      "教学设定优先考虑人物与背景的关系",
      "固定视角有助于练习移动机位",
    ],
    tradeoffs: ["定焦取景需要更多走动", "狭窄空间和远处主体可能难以兼顾"],
    practice: "试试景深任务，比较人物突出与保留环境。",
  },
  {
    id: "demo-travel",
    name: "旅行探索套装",
    body: "进阶机身 · 教学款 C",
    lens: "通用变焦镜头 · 教学款",
    profileId: "generic-v1",
    tagline: "一套装备，留给环境和偶然发现更多空间。",
    accent: "forest",
    icon: "travel",
    subjects: ["travel", "action"],
    portable: "balanced",
    beginnerFriendly: false,
    video: 2,
    budget: { USD: { body: 650, lens: 450 }, CNY: { body: 4500, lens: 3100 } },
    strengths: ["教学设定兼顾多种取景范围", "适合练习环境叙事和运动题材"],
    tradeoffs: ["比轻装组合更需要安排携带空间", "兼顾多种题材意味着有所取舍"],
    practice: "从快门任务开始，理解清晰运动与亮度的配合。",
  },
  {
    id: "demo-hybrid",
    name: "影像双修套装",
    body: "混合拍摄机身 · 教学款 D",
    lens: "标准变焦镜头 · 教学款",
    profileId: "generic-v1",
    tagline: "照片与视频都有位置，先想清楚常用的场景。",
    accent: "slate",
    icon: "video",
    subjects: ["action", "portrait"],
    portable: "flexible",
    beginnerFriendly: false,
    video: 3,
    budget: { USD: { body: 950, lens: 550 }, CNY: { body: 6600, lens: 3900 } },
    strengths: ["教学设定把照片与视频同时纳入选择", "适合比较多目标拍摄的取舍"],
    tradeoffs: ["预算与携带负担更高", "第一轮模拟仍为静态摄影参数教学"],
    practice: "先在自由体验中认识参数，再选择一个摄影任务。",
  },
];

export interface GearState {
  version: 1;
  questionnaire: GearQuestionnaire;
  step: "questionnaire" | "results" | "detail" | "compare";
  detailId: string | null;
  comparedIds: string[];
}

export const GEAR_SUBJECT_LABELS: Record<GearSubject, string> = {
  everyday: "日常记录",
  portrait: "人像互拍",
  travel: "旅行与风景",
  action: "运动与抓拍",
};

export const GEAR_PORTABILITY_LABELS: Record<GearPortability, string> = {
  light: "轻装优先",
  balanced: "平衡便携与功能",
  flexible: "可以多带一些",
};

export function createGearState(): GearState {
  return {
    version: 1,
    questionnaire: {
      currency: "USD",
      budget: "1000",
      subject: "everyday",
      portable: "balanced",
      experience: "first",
      video: "occasionally",
      existing: "",
    },
    step: "questionnaire",
    detailId: null,
    comparedIds: [],
  };
}

function oneOf<T extends string>(
  value: unknown,
  values: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && values.includes(value as T)
    ? (value as T)
    : fallback;
}

export function getGearKit(id: string | null | undefined): GearKit | undefined {
  return GEAR_KITS.find((kit) => kit.id === id);
}

export function sanitizeGearIds(value: unknown, limit = 4): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter(
        (id): id is string => typeof id === "string" && !!getGearKit(id),
      ),
    ),
  ].slice(0, limit);
}

export function parseGearState(raw: string | null): GearState {
  const fallback = createGearState();
  if (!raw || raw.length > 24_000) return fallback;
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data))
      return fallback;
    const value = data as Record<string, unknown>;
    if (value.version !== 1) return fallback;
    const q =
      value.questionnaire &&
      typeof value.questionnaire === "object" &&
      !Array.isArray(value.questionnaire)
        ? (value.questionnaire as Record<string, unknown>)
        : {};
    const rawBudget = typeof q.budget === "string" ? q.budget.trim() : "";
    const budget =
      rawBudget === ""
        ? ""
        : /^\d{1,7}(\.\d{1,2})?$/.test(rawBudget)
          ? String(Math.min(1_000_000, Math.max(0, Number(rawBudget))))
          : fallback.questionnaire.budget;
    const detailId =
      typeof value.detailId === "string" && getGearKit(value.detailId)
        ? value.detailId
        : null;
    const step = oneOf(
      value.step,
      ["questionnaire", "results", "detail", "compare"],
      "questionnaire",
    );
    return {
      version: 1,
      questionnaire: {
        currency: oneOf(q.currency, ["USD", "CNY"], "USD"),
        budget,
        subject: oneOf(
          q.subject,
          ["everyday", "portrait", "travel", "action"],
          "everyday",
        ),
        portable: oneOf(
          q.portable,
          ["light", "balanced", "flexible"],
          "balanced",
        ),
        experience: oneOf(q.experience, ["first", "improving"], "first"),
        video: oneOf(
          q.video,
          ["occasionally", "regularly", "priority"],
          "occasionally",
        ),
        existing:
          typeof q.existing === "string" ? q.existing.trim().slice(0, 160) : "",
      },
      step: step === "detail" && !detailId ? "results" : step,
      detailId,
      comparedIds: sanitizeGearIds(value.comparedIds, 3),
    };
  } catch {
    return fallback;
  }
}

export function gearTotal(kit: GearKit, currency: GearCurrency): number {
  return kit.budget[currency].body + kit.budget[currency].lens;
}

export function formatGearMoney(
  amount: number,
  currency: GearCurrency,
): string {
  return `${currency === "USD" ? "$" : "¥"}${amount.toLocaleString("en-US")}`;
}

export interface GearMatch {
  kit: GearKit;
  score: number;
  reasons: string[];
  considerations: string[];
}

/** Explainable local matching of fictional teaching kits; no purchase advice. */
export function rankGearKits(q: GearQuestionnaire): GearMatch[] {
  const budget = q.budget.trim() === "" ? null : Number(q.budget);
  if (budget !== null && (!Number.isFinite(budget) || budget < 0)) return [];
  return GEAR_KITS.filter(
    (kit) => budget === null || gearTotal(kit, q.currency) <= budget,
  )
    .map((kit): GearMatch => {
      let score = 0;
      const reasons: string[] = [];
      const considerations: string[] = [];
      if (kit.subjects.includes(q.subject)) {
        score += 8;
        reasons.push(`教学定位包含你选择的${GEAR_SUBJECT_LABELS[q.subject]}。`);
      } else
        considerations.push(
          `这套组合的教学重点不在${GEAR_SUBJECT_LABELS[q.subject]}。`,
        );
      if (kit.portable === q.portable || q.portable === "flexible") {
        score += 4;
        reasons.push(
          q.portable === "flexible"
            ? "你愿意为功能留出携带空间。"
            : `便携设定符合“${GEAR_PORTABILITY_LABELS[q.portable]}”。`,
        );
      } else if (q.portable === "light")
        considerations.push("这套组合不是轻装优先的设定，需要权衡携带负担。");
      if (q.experience === "first" && kit.beginnerFriendly) {
        score += 3;
        reasons.push("教学设定适合从基础拍摄开始。");
      } else if (q.experience === "improving" && !kit.beginnerFriendly) {
        score += 2;
        reasons.push("适合继续探索不同拍摄目标的取舍。");
      }
      if (q.video === "priority") {
        score += kit.video * 5;
        if (kit.video === 3)
          reasons.push("在这组示例中，它最重视照片与视频的兼顾。");
        else considerations.push("视频是你的重点，这套示例对视频的侧重较少。");
      } else if (q.video === "regularly") {
        score += kit.video * 2;
        if (kit.video >= 2) reasons.push("教学定位包含较频繁的视频需求。");
      }
      if (budget !== null)
        reasons.push(
          `示例分配 ${formatGearMoney(gearTotal(kit, q.currency), q.currency)}，在你填写的预算内。`,
        );
      if (q.existing.trim())
        considerations.push(
          "已有器材尚未核对卡口或兼容性；当前按完整套装展示，不推断你的镜头可复用。",
        );
      if (!reasons.length)
        reasons.push("保留这套作为另一种取舍，方便与更符合需求的组合比较。");
      return { kit, score, reasons, considerations };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        gearTotal(a.kit, q.currency) - gearTotal(b.kit, q.currency),
    );
}

/** Adding a fourth item leaves the existing, explicit selection unchanged. */
export function toggleComparison(ids: string[], id: string): string[] {
  const clean = sanitizeGearIds(ids, 3);
  if (!getGearKit(id)) return clean;
  return clean.includes(id)
    ? clean.filter((item) => item !== id)
    : clean.length < 3
      ? [...clean, id]
      : clean;
}
