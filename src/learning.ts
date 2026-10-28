import {
  APERTURES,
  DEFAULT_SIM,
  ISOS,
  SHUTTERS,
  evaluateLesson,
  type LessonId,
  type SimSettings,
} from "./domain.ts";

export interface LessonDraft {
  version: 1;
  sim: SimSettings;
  hint: boolean;
  checked: boolean;
  grid: boolean;
  lastRecordedSignature: string | null;
}

export function createLessonDraft(): LessonDraft {
  return {
    version: 1,
    sim: { ...DEFAULT_SIM },
    hint: false,
    checked: false,
    grid: false,
    lastRecordedSignature: null,
  };
}

const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

function index(value: unknown, max: number, fallback: number): number {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= max
    ? value
    : fallback;
}

function settings(value: Record<string, unknown>): SimSettings {
  return {
    shutterIndex: index(
      value.shutterIndex,
      SHUTTERS.length - 1,
      DEFAULT_SIM.shutterIndex,
    ),
    apertureIndex: index(
      value.apertureIndex,
      APERTURES.length - 1,
      DEFAULT_SIM.apertureIndex,
    ),
    isoIndex: index(value.isoIndex, ISOS.length - 1, DEFAULT_SIM.isoIndex),
    viewpoint: index(value.viewpoint, 2, DEFAULT_SIM.viewpoint),
    depthGoal: value.depthGoal === "context" ? "context" : "subject",
  };
}

/** A draft is already namespaced by lesson; grid visibility is not a new attempt. */
export function lessonDraftSignature(draft: LessonDraft): string {
  const { sim } = draft;
  return JSON.stringify([
    sim.shutterIndex,
    sim.apertureIndex,
    sim.isoIndex,
    sim.viewpoint,
    sim.depthGoal,
    draft.hint,
  ]);
}

function validSignature(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 120) return false;
  try {
    const parts = JSON.parse(value);
    if (!Array.isArray(parts) || parts.length !== 6) return false;
    const maxima = [
      SHUTTERS.length - 1,
      APERTURES.length - 1,
      ISOS.length - 1,
      2,
    ];
    return (
      maxima.every((max, i) => index(parts[i], max, -1) !== -1) &&
      (parts[4] === "subject" || parts[4] === "context") &&
      typeof parts[5] === "boolean"
    );
  } catch {
    return false;
  }
}

export function parseLessonDraft(raw: string | null): LessonDraft {
  const empty = createLessonDraft();
  if (!raw || raw.length > 3000) return empty;
  try {
    const data = object(JSON.parse(raw));
    const sim = object(data?.sim);
    if (!data || data.version !== 1 || !sim) return empty;
    const draft: LessonDraft = {
      version: 1,
      sim: settings(sim),
      hint: data.hint === true,
      checked: false,
      grid: data.grid === true,
      lastRecordedSignature: validSignature(data.lastRecordedSignature)
        ? data.lastRecordedSignature
        : null,
    };
    // Initial v1 drafts stored only `checked`; preserve their existing check without recounting it.
    if (data.checked === true && !("lastRecordedSignature" in data)) {
      draft.lastRecordedSignature = lessonDraftSignature(draft);
    }
    draft.checked =
      data.checked === true &&
      draft.lastRecordedSignature === lessonDraftSignature(draft);
    return draft;
  } catch {
    return empty;
  }
}

export function updateLessonDraft<K extends keyof SimSettings>(
  draft: LessonDraft,
  key: K,
  value: SimSettings[K],
): LessonDraft {
  const next = { ...draft, sim: settings({ ...draft.sim, [key]: value }) };
  if (lessonDraftSignature(next) === lessonDraftSignature(draft)) return draft;
  return { ...next, checked: false };
}

export function showLessonHint(draft: LessonDraft): LessonDraft {
  return draft.hint ? draft : { ...draft, hint: true, checked: false };
}

/** Resetting controls does not erase assistance already seen during this lesson. */
export function resetLessonParameters(draft: LessonDraft): LessonDraft {
  return {
    ...draft,
    sim: { ...DEFAULT_SIM, depthGoal: draft.sim.depthGoal },
    checked: false,
  };
}

export function checkLessonDraft(id: LessonId, draft: LessonDraft) {
  const signature = lessonDraftSignature(draft);
  return {
    feedback: evaluateLesson(id, draft.sim),
    record: draft.lastRecordedSignature !== signature,
    draft: { ...draft, checked: true, lastRecordedSignature: signature },
  };
}
