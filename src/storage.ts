import type { LessonId } from "./domain.ts";

export type { LessonId } from "./domain.ts";

export interface LessonRecord {
  lessonId: LessonId;
  attempts: number;
  passed: boolean;
  usedHint: boolean;
  updatedAt: string;
}

export interface CompareRecord {
  id: string;
  source: "demo" | "personal";
  preference: "before" | "after" | "both" | "unsure" | "no-change";
  goal: string;
  createdAt: string;
  reason?: string;
  scenarioId?: string;
}

export interface SavedState {
  version: 1;
  lessons: Partial<Record<LessonId, LessonRecord>>;
  comparisons: CompareRecord[];
}

export const STORAGE_KEY = "frame-mentor-v1";

/** The shared default is frozen; every parser/update returns its own clean state. */
export const EMPTY_STATE: SavedState = {
  version: 1,
  lessons: {},
  comparisons: [],
};
Object.freeze(EMPTY_STATE.lessons);
Object.freeze(EMPTY_STATE.comparisons);
Object.freeze(EMPTY_STATE);

const LESSON_IDS: readonly LessonId[] = ["motion", "depth", "composition"];
const MAX_RAW_LENGTH = 65_536;
const MAX_COMPARISONS = 20;
const MAX_GOAL_LENGTH = 160;

function emptyState(): SavedState {
  return { version: 1, lessons: {}, comparisons: [] };
}

function isObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasFields(
  value: Record<string, unknown>,
  fields: readonly string[],
): boolean {
  return fields.every((key) => Object.hasOwn(value, key));
}

function isLessonId(value: unknown): value is LessonId {
  return typeof value === "string" && LESSON_IDS.includes(value as LessonId);
}

/** Application timestamps are UTC ISO strings from Date.toISOString(). */
function isTimestamp(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  )
    return false;
  const milliseconds = Date.parse(value);
  return (
    Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString() === value
  );
}

function readLesson(value: unknown, expectedId: LessonId): LessonRecord | null {
  if (
    !isObject(value) ||
    !hasFields(value, [
      "lessonId",
      "attempts",
      "passed",
      "usedHint",
      "updatedAt",
    ])
  )
    return null;
  if (
    value.lessonId !== expectedId ||
    typeof value.attempts !== "number" ||
    !Number.isSafeInteger(value.attempts) ||
    value.attempts < 1 ||
    typeof value.passed !== "boolean" ||
    typeof value.usedHint !== "boolean" ||
    !isTimestamp(value.updatedAt)
  )
    return null;

  return {
    lessonId: expectedId,
    attempts: value.attempts,
    passed: value.passed,
    usedHint: value.usedHint,
    updatedAt: value.updatedAt,
  };
}

function isPreference(value: unknown): value is CompareRecord["preference"] {
  return (
    value === "before" ||
    value === "after" ||
    value === "both" ||
    value === "unsure" ||
    value === "no-change"
  );
}

/** Shared by entry forms and persistence so a rejected field is never shown as saved. */
export function isSafeLocalText(
  value: unknown,
  maxLength: number,
  allowEmpty = false,
): value is string {
  return (
    typeof value === "string" &&
    value.length <= maxLength &&
    (allowEmpty || value.trim().length > 0) &&
    !/[\u0000-\u001f\u007f]|(?:[a-z][a-z0-9+.-]*:\/\/|\b(?:data|blob|javascript|file):|\bwww\.)/i.test(
      value,
    )
  );
}

export function isValidComparisonGoal(value: unknown): boolean {
  return (
    typeof value === "string" && isSafeLocalText(value.trim(), MAX_GOAL_LENGTH)
  );
}

export function normalizeComparisonRecord(
  value: unknown,
): CompareRecord | null {
  if (
    !isObject(value) ||
    !hasFields(value, ["id", "source", "preference", "goal", "createdAt"])
  )
    return null;
  if (
    typeof value.id !== "string" ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(value.id) ||
    (value.source !== "demo" && value.source !== "personal") ||
    !isPreference(value.preference) ||
    typeof value.goal !== "string" ||
    !isTimestamp(value.createdAt)
  )
    return null;

  const goal = value.goal.trim();
  // Goals contain short labels only; photo data and URLs belong to transient UI state.
  if (!isValidComparisonGoal(goal)) return null;

  return {
    id: value.id,
    source: value.source,
    preference: value.preference,
    goal,
    createdAt: value.createdAt,
    ...(isSafeLocalText(value.reason, 240)
      ? { reason: value.reason.trim() }
      : {}),
    ...(value.source === "demo" &&
    typeof value.scenarioId === "string" &&
    /^[a-zA-Z0-9_-]{1,60}$/.test(value.scenarioId)
      ? { scenarioId: value.scenarioId }
      : {}),
  };
}

/** Rebuild from an allowlist. Unknown fields, including image/URL/token fields, are discarded. */
function cleanState(value: unknown): SavedState {
  const clean = emptyState();
  if (
    !isObject(value) ||
    !hasFields(value, ["version", "lessons", "comparisons"]) ||
    value.version !== 1 ||
    !isObject(value.lessons) ||
    !Array.isArray(value.comparisons)
  )
    return clean;

  for (const id of LESSON_IDS) {
    if (!Object.hasOwn(value.lessons, id)) continue;
    const lesson = readLesson(value.lessons[id], id);
    if (lesson) clean.lessons[id] = lesson;
  }

  const seen = new Set<string>();
  for (const candidate of value.comparisons) {
    const comparison = normalizeComparisonRecord(candidate);
    if (!comparison || seen.has(comparison.id)) continue;
    seen.add(comparison.id);
    clean.comparisons.push(comparison);
    if (clean.comparisons.length === MAX_COMPARISONS) break;
  }

  return clean;
}

/** No browser APIs are used here, so unavailable localStorage can be handled by the caller. */
export function parseSavedState(raw: string | null): SavedState {
  if (
    typeof raw !== "string" ||
    raw.length === 0 ||
    raw.length > MAX_RAW_LENGTH
  )
    return emptyState();
  try {
    return cleanState(JSON.parse(raw));
  } catch {
    return emptyState();
  }
}

export function recordLesson(
  state: SavedState,
  lessonId: LessonId,
  passed: boolean,
  usedHint: boolean,
  now: string,
): SavedState {
  const next = cleanState(state);
  if (
    !isLessonId(lessonId) ||
    typeof passed !== "boolean" ||
    typeof usedHint !== "boolean" ||
    !isTimestamp(now)
  )
    return next;
  const previous = next.lessons[lessonId];
  next.lessons[lessonId] = {
    lessonId,
    attempts: Math.min((previous?.attempts ?? 0) + 1, Number.MAX_SAFE_INTEGER),
    passed: (previous?.passed ?? false) || passed,
    usedHint: (previous?.usedHint ?? false) || usedHint,
    updatedAt: now,
  };
  return next;
}

export function recordComparison(
  state: SavedState,
  record: CompareRecord,
): SavedState {
  const next = cleanState(state);
  const comparison = normalizeComparisonRecord(record);
  if (!comparison) return next;
  next.comparisons = [
    comparison,
    ...next.comparisons.filter((item) => item.id !== comparison.id),
  ].slice(0, MAX_COMPARISONS);
  return next;
}

export function preferenceLabel(value: CompareRecord["preference"]): string {
  switch (value) {
    case "before":
      return "更喜欢原图";
    case "after":
      return "更喜欢重拍";
    case "both":
      return "两张各有优点";
    case "no-change":
      return "没有明显变化";
    default:
      return "暂时不确定";
  }
}
