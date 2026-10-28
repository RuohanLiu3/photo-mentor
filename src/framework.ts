import { GEAR_KITS } from "./gear.ts";
import { LESSONS, type LessonId } from "./domain.ts";
import { STORAGE_KEY, isSafeLocalText } from "./storage.ts";
import type { CoachContext } from "./coaching.ts";
import type { SimulatorState } from "./simulator.ts";

export const PROFILE_KEY = "frame-profile-v1";
export const COACH_KEY = "frame-coach-v1";
export const GEAR_KEY = "frame-gear-v1";
export const SIMULATOR_KEY = "frame-simulator-v1";

export interface Profile {
  version: 1;
  device: "phone" | "camera";
  cameraBody: string;
  lens: string;
  defaultGearId: string | null;
  favorites: string[];
  owned: string[];
}

export function createProfile(): Profile {
  return {
    version: 1,
    device: "phone",
    cameraBody: "",
    lens: "",
    defaultGearId: null,
    favorites: [],
    owned: [],
  };
}

function text(value: unknown): string {
  if (!isSafeLocalText(value, 100, true)) return "";
  return value.trim();
}

export function parseProfile(raw: string | null): Profile {
  const fresh = createProfile();
  if (!raw || raw.length > 12000) return fresh;
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== "object" || Array.isArray(v) || v.version !== 1)
      return fresh;
    const ids = (value: unknown): string[] =>
      Array.isArray(value)
        ? [
            ...new Set(
              value.filter(
                (id): id is string =>
                  typeof id === "string" && GEAR_KITS.some((k) => k.id === id),
              ),
            ),
          ].slice(0, 20)
        : [];
    const owned = ids(v.owned);
    return {
      version: 1,
      device: v.device === "camera" ? "camera" : "phone",
      cameraBody: text(v.cameraBody),
      lens: text(v.lens),
      owned,
      favorites: ids(v.favorites),
      defaultGearId: owned.includes(v.defaultGearId) ? v.defaultGearId : null,
    };
  } catch {
    return fresh;
  }
}

export function toggleProfileKit(
  profile: Profile,
  collection: "favorites" | "owned",
  id: string,
): Profile {
  if (!GEAR_KITS.some((k) => k.id === id)) return profile;
  const next = profile[collection].includes(id)
    ? profile[collection].filter((x) => x !== id)
    : [...profile[collection], id];
  return {
    ...profile,
    [collection]: next,
    defaultGearId:
      collection === "owned" && !next.includes(profile.defaultGearId ?? "")
        ? null
        : profile.defaultGearId,
  };
}

/** Clear only a removed default; unrelated unsaved form edits remain intact. */
export function reconcileProfileDraft(
  draft: Profile,
  owned: string[],
): Profile {
  return draft.defaultGearId && !owned.includes(draft.defaultGearId)
    ? { ...draft, defaultGearId: null }
    : draft;
}

export function profileEquipmentContext(
  profile: Profile,
): Pick<CoachContext, "device" | "gearId" | "cameraBody" | "lens"> {
  const kit = profile.owned.includes(profile.defaultGearId ?? "")
    ? GEAR_KITS.find((k) => k.id === profile.defaultGearId)
    : undefined;
  return {
    device: profile.device,
    gearId: kit?.id ?? null,
    cameraBody: profile.cameraBody || kit?.body || "",
    lens: profile.lens || kit?.lens || "",
  };
}

export function startSimulatorLesson(
  state: SimulatorState,
  lessonId: LessonId,
): SimulatorState {
  return {
    ...state,
    lessonId,
    activity: "task",
    taskHintSeen: state.lessonId === lessonId ? state.taskHintSeen : false,
  };
}

export const LOCAL_DATA_KEYS = [
  STORAGE_KEY,
  PROFILE_KEY,
  COACH_KEY,
  GEAR_KEY,
  SIMULATOR_KEY,
  ...LESSONS.map((lesson) => `frame-lesson-${lesson.id}-v1`),
] as const;

/** Try every known key and verify deletion without touching another app's storage. */
export function clearLocalData(
  storage: Pick<Storage, "removeItem" | "getItem"> | null,
): { cleared: boolean; failedKeys: string[] } {
  const failedKeys: string[] = [];
  for (const key of LOCAL_DATA_KEYS) {
    try {
      if (!storage) throw new Error("Browser storage unavailable");
      storage.removeItem(key);
      if (storage.getItem(key) !== null) failedKeys.push(key);
    } catch {
      failedKeys.push(key);
    }
  }
  return { cleared: failedKeys.length === 0, failedKeys };
}

export const NAV_ITEMS = [
  { path: "/", label: "首页" },
  { path: "/coach", label: "拍摄" },
  { path: "/learn", label: "学习" },
  { path: "/gear", label: "器材" },
  { path: "/journal", label: "我的" },
] as const;

export function routeFromHash(hash: string): string {
  const path = hash.replace(/^#/, "").split("?")[0] || "/";
  const alias: Record<string, string> = {
    "/records": "/journal",
    "/equipment": "/gear",
    "/simulate": "/simulator",
  };
  const known = [
    "/",
    "/coach",
    "/learn",
    "/gear",
    "/journal",
    "/styles",
    "/simulator",
    "/photos",
    "/lesson/motion",
    "/lesson/depth",
    "/lesson/composition",
  ];
  return known.includes(path)
    ? path
    : Object.hasOwn(alias, path)
      ? alias[path]
      : "/";
}

export function activeNav(path: string): string {
  if (
    path.startsWith("/lesson/") ||
    path === "/styles" ||
    path === "/simulator"
  )
    return "/learn";
  if (path === "/photos") return "/coach";
  return path;
}

export function go(path: string) {
  if (window.location.hash.slice(1) !== path) window.location.hash = path;
}
