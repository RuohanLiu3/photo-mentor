import {
  APERTURES,
  DEFAULT_SIM,
  ISOS,
  SHUTTERS,
  evaluateLesson,
  exposureDelta,
  type Goal,
  type LessonId,
  type SimSettings,
} from "./domain.ts";

export type ExposureMode = "M" | "A" | "S";
export type BodyView = "front" | "back" | "top";
export type Parameter = "shutterIndex" | "apertureIndex" | "isoIndex";

export interface CameraHotspot {
  id: string;
  title: string;
  short: string;
  description: string;
  locations: Partial<Record<BodyView, { x: number; y: number }>>;
}

export interface CameraProfile {
  id: "generic-v1";
  name: string;
  source: "teaching";
  status: "available";
  description: string;
  modes: readonly ExposureMode[];
  shutters: readonly number[];
  apertures: readonly number[];
  isos: readonly number[];
  hotspots: readonly CameraHotspot[];
}

/** A complete teaching profile. No real manufacturer or model is represented. */
export const CAMERA_PROFILES: readonly CameraProfile[] = [
  {
    id: "generic-v1",
    name: "FRAME 通用教学相机",
    source: "teaching",
    status: "available",
    description:
      "练习常见模式、参数和操作位置。外观与数值用于教学，不对应具体机型。",
    modes: ["M", "A", "S"],
    shutters: SHUTTERS,
    apertures: APERTURES,
    isos: ISOS,
    hotspots: [
      {
        id: "shutter",
        title: "快门按钮",
        short: "快门",
        description:
          "通常用于触发拍摄。许多相机支持半按对焦、全按拍摄；本页只解释位置，不模拟对焦系统或实际拍摄。",
        locations: { front: { x: 77, y: 26 }, top: { x: 78, y: 39 } },
      },
      {
        id: "lens",
        title: "镜头与光圈",
        short: "镜头",
        description:
          "光圈控制镜头通光口径，也影响景深。这里固定焦距、距离与画幅；点击取景框中的光圈数值，观察教学示意。",
        locations: { front: { x: 50, y: 59 } },
      },
      {
        id: "mode",
        title: "模式拨盘",
        short: "模式",
        description:
          "M 手动设置快门、光圈与 ISO；A 固定光圈后自动选择快门；S 固定快门后自动选择光圈。本练习中的 ISO 均由你设置。不同品牌的名称和操作会有差异。",
        locations: { top: { x: 25, y: 45 }, back: { x: 25, y: 25 } },
      },
      {
        id: "dial",
        title: "参数拨轮",
        short: "拨轮",
        description:
          "用于改变当前选中的参数。本页用滑杆和加减按钮代替转动拨轮；优先模式中的自动参数由规则计算，达到范围边界时会提示。",
        locations: { top: { x: 78, y: 69 }, back: { x: 79, y: 26 } },
      },
      {
        id: "iso",
        title: "ISO 设置",
        short: "ISO",
        description:
          "提高 ISO 会提高显示增益，也可能使噪点更明显。它不会增加到达传感器的光子。本场景只做趋势示意，不复现机型的高感表现。",
        locations: { top: { x: 60, y: 52 }, back: { x: 79, y: 49 } },
      },
      {
        id: "screen",
        title: "屏幕与构图",
        short: "屏幕",
        description:
          "屏幕帮助观察人物、背景与画面边缘。上方预览使用原创场景，辅助线可以开关；选择不同视点时，比较背景与主体的关系。",
        locations: { back: { x: 43, y: 59 } },
      },
      {
        id: "menu",
        title: "菜单与详细设置",
        short: "菜单",
        description:
          "真实菜单按机型变化。本页点击取景框中的参数进行调节，“说明”提供教学规则；具体机型的菜单需要依据说明书逐台校对后开放。",
        locations: { back: { x: 79, y: 75 } },
      },
    ],
  },
];

export interface SimulatorState {
  version: 1;
  profileId: "generic-v1";
  gearId: string | null;
  requestedModel: string;
  mode: ExposureMode;
  activity: "free" | "task";
  lessonId: LessonId;
  settings: SimSettings;
  bodyView: BodyView;
  hotspotId: string;
  grid: boolean;
  showAdvanced: boolean;
  completedTasks: LessonId[];
  taskHintSeen: boolean;
  lastRecordedSignature: string | null;
}

export function createSimulatorState(): SimulatorState {
  return {
    version: 1,
    profileId: "generic-v1",
    gearId: null,
    requestedModel: "",
    mode: "M",
    activity: "free",
    lessonId: "motion",
    settings: { ...DEFAULT_SIM },
    bodyView: "back",
    hotspotId: "mode",
    grid: false,
    showAdvanced: false,
    completedTasks: [],
    taskHintSeen: false,
    lastRecordedSignature: null,
  };
}

const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

function index(value: unknown, maximum: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(maximum, Math.round(value)))
    : fallback;
}

export function normalizeSimSettings(value: unknown): SimSettings {
  const data = object(value);
  return {
    shutterIndex: index(
      data.shutterIndex,
      SHUTTERS.length - 1,
      DEFAULT_SIM.shutterIndex,
    ),
    apertureIndex: index(
      data.apertureIndex,
      APERTURES.length - 1,
      DEFAULT_SIM.apertureIndex,
    ),
    isoIndex: index(data.isoIndex, ISOS.length - 1, DEFAULT_SIM.isoIndex),
    viewpoint: index(data.viewpoint, 2, 0),
    depthGoal: data.depthGoal === "context" ? "context" : "subject",
  };
}

/** ISO stays manual. Pick the bounded automatic setting nearest this scene's 0 EV target. */
export function resolveExposureMode(
  settings: SimSettings,
  mode: ExposureMode,
): SimSettings {
  const clean = normalizeSimSettings(settings);
  if (mode === "M") return clean;
  const automatic: Parameter = mode === "A" ? "shutterIndex" : "apertureIndex";
  const length = mode === "A" ? SHUTTERS.length : APERTURES.length;
  let best = { ...clean };
  let difference = Math.abs(exposureDelta(best));
  for (let i = 0; i < length; i++) {
    const candidate = { ...clean, [automatic]: i };
    const error = Math.abs(exposureDelta(candidate));
    if (error < difference) {
      best = candidate;
      difference = error;
    }
  }
  return best;
}

export function isAutomatic(parameter: Parameter, mode: ExposureMode): boolean {
  return (
    (mode === "A" && parameter === "shutterIndex") ||
    (mode === "S" && parameter === "apertureIndex")
  );
}

export function updateSimulatorParameter(
  state: SimulatorState,
  parameter: Parameter,
  value: number,
): SimulatorState {
  if (isAutomatic(parameter, state.mode)) return state;
  return {
    ...state,
    settings: resolveExposureMode(
      { ...state.settings, [parameter]: value },
      state.mode,
    ),
  };
}

const lessonIds: readonly LessonId[] = ["motion", "depth", "composition"];

export function parseSimulatorState(raw: string | null): SimulatorState {
  const fallback = createSimulatorState();
  if (!raw || raw.length > 20_000) return fallback;
  try {
    const data = object(JSON.parse(raw));
    if (data.version !== 1) return fallback;
    const mode: ExposureMode =
      data.mode === "A" || data.mode === "S" ? data.mode : "M";
    const bodyView =
      data.bodyView === "front" || data.bodyView === "top"
        ? data.bodyView
        : "back";
    const hotspots = CAMERA_PROFILES[0].hotspots;
    const selected = hotspots.find(
      (item) => item.id === data.hotspotId && item.locations[bodyView],
    );
    return {
      ...fallback,
      gearId:
        typeof data.gearId === "string" &&
        /^[a-z0-9][a-z0-9_-]{0,79}$/i.test(data.gearId)
          ? data.gearId
          : null,
      requestedModel:
        typeof data.requestedModel === "string"
          ? data.requestedModel.trim().slice(0, 80)
          : "",
      mode,
      activity: data.activity === "task" ? "task" : "free",
      lessonId: lessonIds.includes(data.lessonId as LessonId)
        ? (data.lessonId as LessonId)
        : "motion",
      settings: resolveExposureMode(normalizeSimSettings(data.settings), mode),
      bodyView,
      hotspotId:
        selected?.id ?? hotspots.find((item) => item.locations[bodyView])!.id,
      grid: data.grid === true,
      showAdvanced: data.showAdvanced === true,
      completedTasks: lessonIds.filter(
        (id) =>
          Array.isArray(data.completedTasks) &&
          data.completedTasks.includes(id),
      ),
      taskHintSeen: data.taskHintSeen === true,
      lastRecordedSignature:
        typeof data.lastRecordedSignature === "string" &&
        data.lastRecordedSignature.length <= 160
          ? data.lastRecordedSignature
          : null,
    };
  } catch {
    return fallback;
  }
}

export function simulatorGoal(state: SimulatorState): Goal {
  return state.settings.depthGoal === "context" ? "environment" : "portrait";
}

export function simulatorSignature(state: SimulatorState): string {
  return JSON.stringify([
    state.lessonId,
    state.mode,
    state.settings,
    state.taskHintSeen,
  ]);
}

/** A repeated check of the same settings must not inflate learning history. */
export function checkSimulatorTask(state: SimulatorState) {
  const signature = simulatorSignature(state);
  const feedback = evaluateLesson(state.lessonId, state.settings);
  const record = state.lastRecordedSignature !== signature;
  return {
    feedback,
    record,
    state: !record
      ? state
      : {
          ...state,
          completedTasks:
            feedback.passed && !state.completedTasks.includes(state.lessonId)
              ? [...state.completedTasks, state.lessonId]
              : state.completedTasks,
          lastRecordedSignature: signature,
        },
  };
}
