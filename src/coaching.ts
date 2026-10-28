import {
  goalLabel,
  type Constraint,
  type Device,
  type FeedbackDepth,
  type Goal,
  type StyleId,
} from "./domain.ts";
import type { CompareRecord } from "./storage.ts";

export interface CoachContext {
  device: Device;
  goal: Goal;
  style: StyleId;
  gearId: string | null;
  cameraBody: string;
  lens: string;
  constraint: Constraint;
  depth: FeedbackDepth;
}
export type ScenarioId = "overlap" | "environment" | "light";
export type Adjustment = "adjusted" | "unchanged";
export type FixtureMode =
  "normal" | "slow" | "failure" | "unreliable" | "no-change";
export type CoachPhase =
  | "setup"
  | "ready"
  | "pending-guidance"
  | "guidance"
  | "adjust"
  | "pending-comparison"
  | "compare"
  | "saved";
export interface Frame {
  id: string;
  sourceKind: "fixture";
  scenarioId: ScenarioId;
  variant: "before" | Adjustment;
  actionId: string;
  width: number;
  height: number;
}
export interface ResultIdentity {
  requestId: string;
  sessionId: string;
  frameId: string;
  contextVersion: number;
  sourceKind: "fixture";
}
export interface Annotation {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}
export interface Guidance extends ResultIdentity {
  reliable: boolean;
  actionId: string;
  observation: string;
  action: string;
  why: string;
  tradeoff: string;
  nextCheck: string;
  annotation: Annotation;
}
export interface Comparison extends ResultIdentity {
  beforeFrameId: string;
  outcome: "changed" | "unchanged";
  changes: string;
  tradeoff: string;
}
export interface FrameProvider {
  getFrame(
    scenarioId: ScenarioId,
    variant?: "before" | Adjustment,
    actionId?: string,
  ): Frame;
}
export interface GuidanceProvider {
  analyze(
    request: ResultIdentity,
    frame: Frame,
    context: CoachContext,
    alternate: boolean,
    signal: AbortSignal,
    mode?: FixtureMode,
  ): Promise<Guidance>;
}
export interface ComparisonProvider {
  compare(
    request: ResultIdentity,
    before: Frame,
    after: Frame,
    guidance: Guidance,
    context: CoachContext,
    signal: AbortSignal,
    mode?: FixtureMode,
  ): Promise<Comparison>;
}
export interface CoachSession {
  version: 1;
  id: string;
  contextVersion: number;
  context: CoachContext;
  scenarioId: ScenarioId;
  phase: CoachPhase;
  frame: Frame;
  afterFrame: Frame | null;
  guidance: Guidance | null;
  comparison: Comparison | null;
  pending: (ResultIdentity & { kind: "guidance" | "comparison" }) | null;
  alternate: boolean;
  preference: CompareRecord["preference"] | null;
  reason: string;
  recordId: string;
  savedAt: string | null;
  notice: string | null;
}

export const SCENARIOS: ReadonlyArray<{
  id: ScenarioId;
  title: string;
  description: string;
  goal: Goal;
}> = [
  {
    id: "overlap",
    title: "背景太乱",
    description: "街角人像 · 让轮廓与线条分开",
    goal: "portrait",
  },
  {
    id: "environment",
    title: "不知道怎么构图",
    description: "旅行人像 · 人物与地点的取舍",
    goal: "environment",
  },
  {
    id: "light",
    title: "想改善面部光线",
    description: "窗边人像 · 比较亮面与阴影",
    goal: "portrait",
  },
];
const DEFAULT_CONTEXT: CoachContext = {
  device: "phone",
  goal: "portrait",
  style: "none",
  gearId: null,
  cameraBody: "",
  lens: "",
  constraint: "none",
  depth: "simple",
};
function id(): string {
  return `coach-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}
export const fixtureFrameProvider: FrameProvider = {
  getFrame(scenarioId, variant = "before", actionId = "original") {
    return {
      id: `${scenarioId}-${variant}-${actionId}`,
      sourceKind: "fixture",
      scenarioId,
      variant,
      actionId,
      width: scenarioId === "light" ? 405 : 720,
      height: 540,
    };
  },
};
export function createCoachSession(
  context: Partial<CoachContext> = {},
): CoachSession {
  const sessionId = id();
  return {
    version: 1,
    id: sessionId,
    contextVersion: 1,
    context: cleanContext({ ...DEFAULT_CONTEXT, ...context }),
    scenarioId: "overlap",
    phase: "setup",
    frame: fixtureFrameProvider.getFrame("overlap"),
    afterFrame: null,
    guidance: null,
    comparison: null,
    pending: null,
    alternate: false,
    preference: null,
    reason: "",
    recordId: `${sessionId}-v1`,
    savedAt: null,
    notice: null,
  };
}
function invalidate(session: CoachSession): CoachSession {
  const contextVersion = session.contextVersion + 1;
  return {
    ...session,
    contextVersion,
    phase: "setup",
    frame: fixtureFrameProvider.getFrame(session.scenarioId),
    afterFrame: null,
    guidance: null,
    comparison: null,
    pending: null,
    alternate: false,
    preference: null,
    reason: "",
    recordId: `${session.id}-v${contextVersion}`,
    savedAt: null,
    notice: null,
  };
}
export function patchCoachContext(
  session: CoachSession,
  partialContext: Partial<CoachContext>,
): CoachSession {
  const context = cleanContext({ ...session.context, ...partialContext });
  return Object.keys(context).some(
    (key) =>
      context[key as keyof CoachContext] !==
      session.context[key as keyof CoachContext],
  )
    ? { ...invalidate(session), context }
    : session;
}
function cleanContext(context: CoachContext): CoachContext {
  return {
    ...context,
    cameraBody: shortText(context.cameraBody),
    lens: shortText(context.lens),
    gearId:
      context.gearId &&
      ["demo-pocket", "demo-portrait", "demo-travel", "demo-hybrid"].includes(
        context.gearId,
      )
        ? context.gearId
        : null,
  };
}
export function patchCoachReason(
  session: CoachSession,
  reason: string,
): CoachSession {
  return { ...session, reason: shortText(reason, 200) };
}
export function hasAlternateCoachAction(session: CoachSession): boolean {
  if (!session.guidance) return false;
  const identity: ResultIdentity = {
    requestId: "preview",
    sessionId: session.id,
    frameId: session.frame.id,
    contextVersion: session.contextVersion,
    sourceKind: "fixture",
  };
  return (
    fixtureGuidance(
      identity,
      session.frame,
      session.context,
      !session.alternate,
    ).actionId !== session.guidance.actionId
  );
}
export function selectCoachScenario(
  session: CoachSession,
  scenarioId: ScenarioId,
): CoachSession {
  if (scenarioId === session.scenarioId) return session;
  return invalidate({ ...session, scenarioId });
}

export function fixtureGuidance(
  request: ResultIdentity,
  frame: Frame,
  context: CoachContext,
  alternate = false,
  reliable = true,
): Guidance {
  const fixedCamera = context.constraint === "camera";
  const fixedSubject = context.constraint === "subject";
  const environmentGoal = context.goal === "environment";
  let actionId: string,
    observation: string,
    action: string,
    why: string,
    tradeoff: string,
    nextCheck: string,
    annotation: Annotation;
  if (frame.scenarioId === "overlap") {
    const moveSubject = fixedCamera || (!fixedSubject && alternate);
    actionId = moveSubject ? "overlap-subject" : "overlap-camera";
    observation = "原始示例中，路灯竖线从人物头部后方经过。";
    action = moveSubject
      ? "保持手机机位，请人物向画面左侧小幅移动，让头部与路灯分开。"
      : "保持人物位置，小幅向侧面移动手机，让头部轮廓与路灯分开。";
    why = `轮廓与背景线条分开后，人物更容易辨认。${environmentGoal ? "窗和街边桌椅仍保留，地点信息没有完全舍弃。" : "这组示例先处理干扰，而不是追求固定的三分线。"}`;
    tradeoff = moveSubject
      ? "人物移动可能改变原来的姿态和受光；调整后需要重新确认。"
      : "改变视点也会改变背景关系，实拍要检查画面边缘。";
    nextCheck = "对照人物头部与路灯之间是否出现间隔。";
    annotation = {
      x: 43,
      y: 20,
      width: 16,
      height: 27,
      label: "轮廓与竖线重叠",
    };
  } else if (frame.scenarioId === "environment") {
    if (fixedCamera || (alternate && !fixedSubject)) {
      actionId = "environment-subject";
      observation = "人物挡住了旅行地标的一部分，画面中的地点线索不够完整。";
      action = "保持手机机位，请人物向右侧小幅移动，露出身后的山形标志。";
      why = "在同一个视点内，人物与环境线索可以各自有清楚的位置。";
      tradeoff = "人物会偏离画面中心；是否喜欢这种平衡由你的表达目标决定。";
      nextCheck = "检查山形标志是否露出，同时保留人物完整轮廓。";
    } else {
      actionId =
        environmentGoal || (context.goal === "creative" && !alternate)
          ? "environment-wide"
          : "environment-tight";
      const wide = actionId === "environment-wide";
      observation =
        "这张旅行人像同时有山景、地标和人物，可以选择不同的视觉重点。";
      action = wide
        ? "保持人物位置，在安全空间里稍向后退，给山景与地标留出更多画面。"
        : "保持人物位置，在安全空间里稍向前取景，提高人物在画面中的占比。";
      why = wide
        ? "让环境参与讲述地点，人物仍是故事的一部分。"
        : "减少环境占比，让视线更容易停留在人物上。";
      tradeoff = wide
        ? "人物会变小；如果更在意表情，原来的版本也可能更适合。"
        : "地点线索会减少，旅行环境的叙事感也会减弱。";
      nextCheck = wide
        ? "比较山景与地标是否更完整，以及人物是否变得太小。"
        : "比较人物占比，同时留意被舍弃的山景和地标。";
    }
    annotation = {
      x: 16,
      y: 36,
      width: 34,
      height: 38,
      label: "人物与地点的关系",
    };
  } else {
    const changeView = fixedSubject || (!fixedCamera && alternate);
    actionId = changeView ? "light-viewpoint" : "light-turn";
    observation = "窗光从左侧进入，人物面部朝向较暗的一侧。";
    action = changeView
      ? "保持人物位置和姿态，小幅改变手机观察角度，尝试更多地看见面部受光的一侧。"
      : "保持手机机位，请人物把脸稍转向左侧窗光，再比较面部的亮面与阴影。";
    why = "观察光线与面部方向的关系，帮助决定想保留怎样的明暗层次。";
    tradeoff = changeView
      ? "视角与背景也会变化。图示只说明关系，不保证真实现场的亮度。"
      : "转脸会改变表情和轮廓；原来的阴影也可以是有意的表达。";
    nextCheck = "比较面部可见亮面的范围，不把更亮直接等同于更好。";
    annotation = {
      x: 43,
      y: 24,
      width: 34,
      height: 29,
      label: "面部的亮面与阴影",
    };
  }
  const styleChecks = {
    none: "",
    geometry: " 按照几何关系参考，也留意背景线条是否更有秩序。",
    environment: " 按照环境叙事参考，也检查地点线索有没有被舍弃。",
    light: " 按照明暗层次参考，也观察人物与背景的亮暗关系。",
  };
  return {
    ...request,
    reliable,
    actionId,
    observation,
    action,
    why,
    tradeoff,
    nextCheck: nextCheck + styleChecks[context.style],
    annotation,
  };
}
export function fixtureComparison(
  request: ResultIdentity,
  before: Frame,
  after: Frame,
  guidance: Guidance,
  context: CoachContext,
): Comparison {
  const unchanged = after.variant === "unchanged";
  const changes: Record<string, string> = {
    "overlap-camera":
      "调整版改变了观察视点：人物与路灯竖线之间出现了间隔。窗框的位置也发生了变化。",
    "overlap-subject": "机位保持不变，人物向左移动后，头部轮廓与路灯分开了。",
    "environment-subject":
      "机位与环境保持不变，人物移向右侧，让山形标志露出了更多。",
    "environment-wide":
      "调整版纳入了更多山景与地标，人物占比下降，地点信息增加。",
    "environment-tight": "调整版提高了人物占比，同时舍弃了一部分山景和地标。",
    "light-turn":
      "调整版人物面部朝窗光转动，受光一侧更可见；窗与机位保持不变。",
    "light-viewpoint":
      "调整版改变观察角度，看见更多面部受光区域，窗与人物的相对位置也变化了。",
  };
  return {
    ...request,
    beforeFrameId: before.id,
    outcome: unchanged ? "unchanged" : "changed",
    changes: unchanged
      ? "这次选择的画面与原图相同，没有可观察到的变化。可以保留原图，也可以重新尝试。"
      : `${changes[guidance.actionId]} 当前目标是“${goalLabel(context.goal)}”，是否更符合你的表达仍由你决定。`,
    tradeoff: guidance.tradeoff,
  };
}
async function fixtureWait(
  signal: AbortSignal,
  mode: FixtureMode,
): Promise<void> {
  if (signal.aborted) throw new DOMException("已取消", "AbortError");
  await new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      reject(new DOMException("已取消", "AbortError"));
    };
    const timer = setTimeout(
      () => {
        signal.removeEventListener("abort", abort);
        resolve();
      },
      mode === "slow" ? 4000 : 450,
    );
    signal.addEventListener("abort", abort, { once: true });
  });
  if (mode === "failure")
    throw new Error("示例加载没有完成。可以重试，或返回准备页更换场景。");
}
export const fixtureGuidanceProvider: GuidanceProvider = {
  async analyze(request, frame, context, alternate, signal, mode = "normal") {
    await fixtureWait(signal, mode);
    return fixtureGuidance(
      request,
      frame,
      context,
      alternate,
      mode !== "unreliable",
    );
  },
};
export const fixtureComparisonProvider: ComparisonProvider = {
  async compare(
    request,
    before,
    after,
    guidance,
    context,
    signal,
    mode = "normal",
  ) {
    await fixtureWait(signal, mode);
    return fixtureComparison(request, before, after, guidance, context);
  },
};
export function beginCoachRequest(
  session: CoachSession,
  kind: "guidance" | "comparison",
): CoachSession {
  if (
    kind === "comparison" &&
    (!session.afterFrame || !session.guidance?.reliable)
  )
    return session;
  const frame = kind === "comparison" ? session.afterFrame! : session.frame;
  return {
    ...session,
    phase: kind === "guidance" ? "pending-guidance" : "pending-comparison",
    pending: {
      requestId: id(),
      sessionId: session.id,
      frameId: frame.id,
      contextVersion: session.contextVersion,
      sourceKind: "fixture",
      kind,
    },
    notice: null,
  };
}
export function isCurrentCoachResult(
  session: CoachSession,
  result: ResultIdentity,
): boolean {
  return (
    !!session.pending &&
    session.pending.requestId === result.requestId &&
    session.id === result.sessionId &&
    session.contextVersion === result.contextVersion &&
    session.pending.frameId === result.frameId &&
    result.sourceKind === "fixture"
  );
}
export function acceptCoachGuidance(
  session: CoachSession,
  guidance: Guidance,
): CoachSession {
  if (
    !isCurrentCoachResult(session, guidance) ||
    session.pending?.kind !== "guidance"
  )
    return session;
  return {
    ...session,
    phase: "guidance",
    pending: null,
    guidance,
    afterFrame: null,
    comparison: null,
    notice: null,
  };
}
export function acceptCoachComparison(
  session: CoachSession,
  comparison: Comparison,
): CoachSession {
  if (
    !isCurrentCoachResult(session, comparison) ||
    session.pending?.kind !== "comparison" ||
    comparison.beforeFrameId !== session.frame.id
  )
    return session;
  return {
    ...session,
    phase: "compare",
    pending: null,
    comparison,
    notice: null,
  };
}
export function cancelCoachRequest(
  session: CoachSession,
  notice = "已暂停加载，进度保留。可以继续。",
): CoachSession {
  if (!session.pending) return session;
  return {
    ...session,
    phase: session.pending.kind === "comparison" ? "adjust" : "ready",
    pending: null,
    notice,
  };
}
export function chooseCoachAdjustment(
  session: CoachSession,
  variant: Adjustment,
): CoachSession {
  if (!session.guidance?.reliable) return session;
  return {
    ...session,
    afterFrame: fixtureFrameProvider.getFrame(
      session.scenarioId,
      variant,
      session.guidance.actionId,
    ),
    phase: "adjust",
    comparison: null,
    pending: null,
    preference: null,
    reason: "",
    savedAt: null,
  };
}
export function coachComparisonRecord(
  session: CoachSession,
  now = new Date().toISOString(),
): (CompareRecord & { reason?: string; scenarioId?: string }) | null {
  if (!session.comparison || !session.preference) return null;
  return {
    id: session.recordId,
    source: "demo",
    preference: session.preference,
    goal: goalLabel(session.context.goal),
    createdAt: session.savedAt ?? now,
    reason: shortText(session.reason, 200),
    scenarioId: session.scenarioId,
  };
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function oneOf<T extends string>(
  value: unknown,
  options: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && options.includes(value as T)
    ? (value as T)
    : fallback;
}
function shortText(value: unknown, max = 100): string {
  return typeof value === "string" &&
    !/(?:[a-z][a-z0-9+.-]*:\/\/|\b(?:data|blob|javascript|file):|\bwww\.)/i.test(
      value,
    )
    ? value.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, max)
    : "";
}
/** Persist only reconstructable fixture identity and bounded context, never photo data or URLs. */
export function parseCoachSession(raw: string | null): CoachSession {
  const empty = createCoachSession();
  if (!raw || raw.length > 24_000) return empty;
  try {
    const data: unknown = JSON.parse(raw);
    if (
      !object(data) ||
      data.version !== 1 ||
      !object(data.context) ||
      typeof data.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(data.id)
    )
      return empty;
    const c = data.context;
    const context: CoachContext = {
      device: oneOf(c.device, ["phone", "camera", "unknown"], "phone"),
      goal: oneOf(c.goal, ["portrait", "environment", "creative"], "portrait"),
      style: oneOf(
        c.style,
        ["none", "geometry", "environment", "light"],
        "none",
      ),
      gearId:
        typeof c.gearId === "string" &&
        ["demo-pocket", "demo-portrait", "demo-travel", "demo-hybrid"].includes(
          c.gearId,
        )
          ? c.gearId
          : null,
      cameraBody: shortText(c.cameraBody),
      lens: shortText(c.lens),
      constraint: oneOf(c.constraint, ["none", "camera", "subject"], "none"),
      depth: oneOf(c.depth, ["simple", "explore"], "simple"),
    };
    const scenarioId = oneOf(
      data.scenarioId,
      ["overlap", "environment", "light"],
      "overlap",
    );
    const contextVersion =
      typeof data.contextVersion === "number" &&
      Number.isSafeInteger(data.contextVersion) &&
      data.contextVersion > 0 &&
      data.contextVersion < 1_000_000
        ? data.contextVersion
        : 1;
    let phase = oneOf(
      data.phase,
      [
        "setup",
        "ready",
        "pending-guidance",
        "guidance",
        "adjust",
        "pending-comparison",
        "compare",
        "saved",
      ],
      "setup",
    );
    const frame = fixtureFrameProvider.getFrame(scenarioId);
    const identity: ResultIdentity = {
      requestId: "restored",
      sessionId: data.id,
      contextVersion,
      frameId: frame.id,
      sourceKind: "fixture",
    };
    const validIdentity = (value: Record<string, unknown>) =>
      value.sessionId === data.id &&
      value.contextVersion === contextVersion &&
      value.sourceKind === "fixture";
    const alternate = data.alternate === true;
    const guidance =
      object(data.guidance) &&
      validIdentity(data.guidance) &&
      data.guidance.frameId === frame.id
        ? fixtureGuidance(
            identity,
            frame,
            context,
            alternate,
            data.guidance.reliable !== false,
          )
        : null;
    const afterFrame =
      guidance?.reliable &&
      object(data.afterFrame) &&
      data.afterFrame.scenarioId === scenarioId &&
      data.afterFrame.actionId === guidance.actionId &&
      (data.afterFrame.variant === "adjusted" ||
        data.afterFrame.variant === "unchanged")
        ? fixtureFrameProvider.getFrame(
            scenarioId,
            data.afterFrame.variant,
            guidance.actionId,
          )
        : null;
    const comparison =
      guidance &&
      afterFrame &&
      object(data.comparison) &&
      validIdentity(data.comparison) &&
      data.comparison.frameId === afterFrame.id &&
      data.comparison.beforeFrameId === frame.id
        ? fixtureComparison(
            { ...identity, frameId: afterFrame.id },
            frame,
            afterFrame,
            guidance,
            context,
          )
        : null;
    let notice: string | null = null;
    if (phase === "pending-guidance" || phase === "pending-comparison") {
      phase = phase === "pending-comparison" && guidance ? "adjust" : "ready";
      notice = "已恢复示例进度。上次加载已暂停，请点继续重新加载。";
    }
    if (["compare", "saved"].includes(phase) && !comparison)
      phase = guidance ? "adjust" : "ready";
    if (["guidance", "adjust"].includes(phase) && !guidance) phase = "ready";
    const preference =
      data.preference === null
        ? null
        : oneOf(
            data.preference,
            ["before", "after", "both", "unsure", "no-change"],
            "unsure",
          );
    const savedAt =
      typeof data.savedAt === "string" &&
      /^\d{4}-\d{2}-\d{2}T/.test(data.savedAt) &&
      Number.isFinite(Date.parse(data.savedAt))
        ? new Date(data.savedAt).toISOString()
        : null;
    if (phase === "saved" && (!savedAt || !preference)) phase = "compare";
    return {
      version: 1,
      id: data.id,
      contextVersion,
      context,
      scenarioId,
      phase,
      frame,
      guidance,
      afterFrame,
      comparison,
      pending: null,
      alternate,
      preference,
      reason: shortText(data.reason, 200),
      recordId: `${data.id}-v${contextVersion}`,
      savedAt,
      notice,
    };
  } catch {
    return empty;
  }
}
