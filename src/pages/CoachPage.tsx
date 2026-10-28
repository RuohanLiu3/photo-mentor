import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Eye,
  Grid2X2,
  LoaderCircle,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  X,
  ZoomIn,
} from "lucide-react";
import { goalLabel, STYLE_CARDS, type Constraint, type Goal } from "../domain";
import type { CompareRecord } from "../storage";
import {
  acceptCoachComparison,
  acceptCoachGuidance,
  beginCoachRequest,
  cancelCoachRequest,
  chooseCoachAdjustment,
  coachComparisonRecord,
  createCoachSession,
  fixtureComparisonProvider,
  fixtureGuidanceProvider,
  hasAlternateCoachAction,
  patchCoachContext,
  patchCoachReason,
  SCENARIOS,
  selectCoachScenario,
  type CoachContext,
  type CoachSession,
  type FixtureMode,
  type Frame,
} from "../coaching";
import FixtureScene from "../components/coach/FixtureScene";
import "../coaching.css";

type Props = {
  session: CoachSession;
  setSession: Dispatch<SetStateAction<CoachSession>>;
  onSave: (
    record: CompareRecord & { reason?: string; scenarioId?: string },
  ) => void;
  onStyles: () => void;
  onPersonal: () => void;
};
const constraints: Array<{ value: Constraint; label: string }> = [
  { value: "none", label: "都可以调整" },
  { value: "camera", label: "手机机位固定" },
  { value: "subject", label: "人物不能调整" },
];

function CompareView({ session }: { session: CoachSession }) {
  const [mode, setMode] = useState<"split" | "toggle">("split");
  const [active, setActive] = useState<"before" | "after">("before");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{
    x: number;
    y: number;
    px: number;
    py: number;
    width: number;
    height: number;
  } | null>(null);
  const maxPan = (zoom - 1) * 50;
  const clamp = (value: number) => Math.max(-maxPan, Math.min(maxPan, value));
  const frame = (value: Frame, label: string) => (
    <div className="coach-compare-cell" key={label}>
      <div className="coach-image-label">
        {label}
        <span>内置示例</span>
      </div>
      <div
        className={`coach-pan ${zoom > 1 ? "coach-pan-active" : ""}`}
        style={{ aspectRatio: `${value.width} / ${value.height}` }}
        tabIndex={0}
        role="group"
        aria-label={`${label}，${zoom > 1 ? "拖动或使用方向键平移" : "先放大以查看细节"}`}
        onKeyDown={(event) => {
          const offsets: Record<string, [number, number]> = {
            ArrowLeft: [3, 0],
            ArrowRight: [-3, 0],
            ArrowUp: [0, 3],
            ArrowDown: [0, -3],
          };
          if (offsets[event.key] && zoom > 1) {
            event.preventDefault();
            const [x, y] = offsets[event.key];
            setPan((p) => ({ x: clamp(p.x + x), y: clamp(p.y + y) }));
          }
        }}
        onPointerDown={(event) => {
          if (zoom <= 1) return;
          const rect = event.currentTarget.getBoundingClientRect();
          drag.current = {
            x: event.clientX,
            y: event.clientY,
            px: pan.x,
            py: pan.y,
            width: rect.width,
            height: rect.height,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const d = drag.current;
          if (d)
            setPan({
              x: clamp(d.px + ((event.clientX - d.x) / d.width) * 100),
              y: clamp(d.py + ((event.clientY - d.y) / d.height) * 100),
            });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <div
          className="coach-transform"
          style={{
            transform: `translate(${pan.x}%, ${pan.y}%) scale(${zoom})`,
          }}
        >
          <FixtureScene frame={value} />
        </div>
      </div>
    </div>
  );
  return (
    <section className="coach-comparison" aria-label="示例前后对比">
      <div className="coach-toolbar">
        <div className="coach-segment">
          <button
            type="button"
            aria-pressed={mode === "split"}
            onClick={() => setMode("split")}
          >
            <Grid2X2 size={15} />
            并排
          </button>
          <button
            type="button"
            aria-pressed={mode === "toggle"}
            onClick={() => setMode("toggle")}
          >
            A / B 切换
          </button>
        </div>
        {mode === "toggle" && (
          <div className="coach-segment">
            <button
              type="button"
              aria-pressed={active === "before"}
              onClick={() => setActive("before")}
            >
              A 原图
            </button>
            <button
              type="button"
              aria-pressed={active === "after"}
              onClick={() => setActive("after")}
            >
              B 调整后
            </button>
          </div>
        )}
      </div>
      <div
        className={`coach-compare-images ${mode === "split" ? "coach-compare-split" : ""}`}
      >
        {(mode === "split" || active === "before") &&
          frame(session.frame, "A · 原图")}
        {(mode === "split" || active === "after") &&
          frame(session.afterFrame!, "B · 调整后")}
      </div>
      <div className="coach-zoom">
        <ZoomIn size={17} />
        <label htmlFor="coach-zoom">同步缩放</label>
        <input
          id="coach-zoom"
          type="range"
          min="1"
          max="2.5"
          step=".1"
          value={zoom}
          onChange={(e) => {
            setZoom(Number(e.target.value));
            setPan({ x: 0, y: 0 });
          }}
        />
        <output>{zoom.toFixed(1)}×</output>
        <button
          type="button"
          className="coach-icon-btn"
          aria-label="重置缩放和平移"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          <RotateCcw size={17} />
        </button>
      </div>
      <p className="coach-fine">
        放大后可拖动画面，两张图同步平移；不同构图不代表像素对齐。
      </p>
    </section>
  );
}

export default function CoachPage({
  session,
  setSession,
  onSave,
  onStyles,
  onPersonal,
}: Props) {
  const [annotations, setAnnotations] = useState(true);
  const [reference, setReference] = useState(false);
  const [cannot, setCannot] = useState(false);
  const [showWhy, setShowWhy] = useState<boolean | null>(null);
  const [qaMode, setQaMode] = useState<FixtureMode>("normal");
  const request = useRef<{
    controller: AbortController;
    requestId: string;
  } | null>(null);
  const referenceButton = useRef<HTMLButtonElement>(null);
  const referenceClose = useRef<HTMLButtonElement>(null);
  const { phase, context, guidance } = session;
  const pending = !!session.pending;
  const comparing = phase === "compare" || phase === "saved";
  const scenario = SCENARIOS.find((value) => value.id === session.scenarioId)!;
  useEffect(
    () => () => {
      request.current?.controller.abort();
      setSession((current) => cancelCoachRequest(current));
    },
    [setSession],
  );
  useEffect(() => {
    if (reference) referenceClose.current?.focus();
  }, [reference]);
  const patch = (value: Partial<CoachContext>) => {
    request.current?.controller.abort();
    setSession((current) => patchCoachContext(current, value));
    setCannot(false);
  };
  const closeReference = () => {
    setReference(false);
    referenceButton.current?.focus();
  };
  const run = async (
    snapshot: CoachSession,
    kind: "guidance" | "comparison",
    mode: FixtureMode = qaMode,
  ) => {
    request.current?.controller.abort();
    if (kind === "comparison" && mode === "no-change")
      snapshot = chooseCoachAdjustment(snapshot, "unchanged");
    const next = beginCoachRequest(snapshot, kind);
    if (!next.pending) return;
    const envelope = next.pending;
    const controller = new AbortController();
    request.current = { controller, requestId: envelope.requestId };
    setSession(next);
    setCannot(false);
    try {
      if (kind === "guidance") {
        const result = await fixtureGuidanceProvider.analyze(
          envelope,
          next.frame,
          next.context,
          next.alternate,
          controller.signal,
          mode,
        );
        setSession((current) => acceptCoachGuidance(current, result));
      } else {
        const result = await fixtureComparisonProvider.compare(
          envelope,
          next.frame,
          next.afterFrame!,
          next.guidance!,
          next.context,
          controller.signal,
          mode,
        );
        setSession((current) => acceptCoachComparison(current, result));
      }
    } catch (error) {
      if (!controller.signal.aborted)
        setSession((current) =>
          current.pending?.requestId === envelope.requestId
            ? cancelCoachRequest(
                current,
                error instanceof Error
                  ? error.message
                  : "加载没有完成，请重试。",
              )
            : current,
        );
    } finally {
      if (request.current?.requestId === envelope.requestId)
        request.current = null;
    }
  };
  const back = () => {
    request.current?.controller.abort();
    setSession((current) => ({
      ...cancelCoachRequest(current),
      phase: "setup",
      notice: null,
    }));
  };
  const save = () => {
    const record = coachComparisonRecord(session);
    if (!record) return;
    onSave(record);
    setSession((current) =>
      current.recordId === record.id
        ? { ...current, phase: "saved", savedAt: record.createdAt }
        : current,
    );
  };
  const step =
    phase === "setup"
      ? 0
      : comparing
        ? 3
        : ["adjust", "pending-comparison"].includes(phase)
          ? 2
          : 1;
  return (
    <div className="coach-page">
      <header className="coach-heading">
        <div>
          <h1>
            {phase === "setup"
              ? "拍摄准备"
              : comparing
                ? "前后对比"
                : "拍摄指导"}
          </h1>
          <p>选择示例，尝试调整，再比较变化。</p>
        </div>
        <span className="coach-source">
          <span />
          示例模式
        </span>
      </header>
      <ol className="coach-steps" aria-label="拍摄体验进度">
        {["准备", "查看建议", "尝试调整", "对比记录"].map((label, index) => (
          <li
            key={label}
            aria-current={step === index ? "step" : undefined}
            className={step >= index ? "coach-step-active" : ""}
          >
            <span>{step > index ? <Check size={13} /> : `0${index + 1}`}</span>
            {label}
          </li>
        ))}
      </ol>
      {session.notice && (
        <div className="coach-notice" role="status">
          {session.notice}
        </div>
      )}
      {phase === "setup" ? (
        <div className="coach-setup">
          <div className="coach-setup-form">
            <section className="coach-card">
              <h2>选择拍摄设备</h2>
              <p className="coach-muted">两种方式都以手机观察现场为起点。</p>
              <div className="coach-device-options">
                {[
                  {
                    id: "phone",
                    title: "最终用手机拍",
                    text: "从构图、机位和用光开始",
                  },
                  {
                    id: "camera",
                    title: "最终用相机拍",
                    text: "手机辅助观察，手动操作相机",
                  },
                ].map((device) => (
                  <button
                    type="button"
                    key={device.id}
                    aria-pressed={context.device === device.id}
                    onClick={() =>
                      patch({ device: device.id as "phone" | "camera" })
                    }
                  >
                    <span>{device.title}</span>
                    <small>{device.text}</small>
                    {context.device === device.id && <Check size={16} />}
                  </button>
                ))}
              </div>
              {context.device === "camera" && (
                <div className="coach-fields">
                  <label>
                    机身 <span>可选</span>
                    <input
                      value={context.cameraBody}
                      maxLength={100}
                      placeholder="例如：我的相机"
                      onChange={(e) => patch({ cameraBody: e.target.value })}
                    />
                  </label>
                  <label>
                    镜头 <span>可选</span>
                    <input
                      value={context.lens}
                      maxLength={100}
                      placeholder="例如：常用变焦镜头"
                      onChange={(e) => patch({ lens: e.target.value })}
                    />
                  </label>
                  <p className="coach-fine">
                    仅用于本次设置。示例不识别器材，也不提供未经验证的相机参数。
                  </p>
                </div>
              )}
            </section>
            <section className="coach-card">
              <h2>选择拍摄问题</h2>
              <div className="coach-scenario-options">
                {SCENARIOS.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    aria-pressed={session.scenarioId === item.id}
                    onClick={() =>
                      setSession((current) =>
                        selectCoachScenario(current, item.id),
                      )
                    }
                  >
                    <span>{item.title}</span>
                    <small>{item.description}</small>
                    {session.scenarioId === item.id && <Check size={16} />}
                  </button>
                ))}
              </div>
              <label className="coach-label">这次更想表达什么？</label>
              <div className="coach-chips">
                {(["portrait", "environment", "creative"] as Goal[]).map(
                  (goal) => (
                    <button
                      type="button"
                      key={goal}
                      aria-pressed={context.goal === goal}
                      onClick={() => patch({ goal })}
                    >
                      {goalLabel(goal)}
                    </button>
                  ),
                )}
              </div>
            </section>
            <section className="coach-card">
              <details className="coach-details">
                <summary>
                  风格参考与现场限制 <ChevronDown size={16} />
                </summary>
                <div className="coach-settings">
                  <label className="coach-label">参考一种观察方法</label>
                  <div className="coach-chips">
                    <button
                      type="button"
                      aria-pressed={context.style === "none"}
                      onClick={() => patch({ style: "none" })}
                    >
                      暂时不选
                    </button>
                    {STYLE_CARDS.map((card) => (
                      <button
                        type="button"
                        key={card.id}
                        aria-pressed={context.style === card.id}
                        onClick={() => patch({ style: card.id })}
                      >
                        {card.title}
                      </button>
                    ))}
                  </div>
                  <label className="coach-label" htmlFor="coach-constraint">
                    现场有哪些限制？
                  </label>
                  <select
                    id="coach-constraint"
                    value={context.constraint}
                    onChange={(event) =>
                      patch({ constraint: event.target.value as Constraint })
                    }
                  >
                    {constraints.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <div className="coach-chips">
                    <button
                      type="button"
                      aria-pressed={context.depth === "simple"}
                      onClick={() => patch({ depth: "simple" })}
                    >
                      简洁指导
                    </button>
                    <button
                      type="button"
                      aria-pressed={context.depth === "explore"}
                      onClick={() => patch({ depth: "explore" })}
                    >
                      讲解模式
                    </button>
                  </div>
                </div>
              </details>
            </section>
            <button
              type="button"
              className="coach-primary coach-start"
              onClick={() =>
                setSession((current) => ({
                  ...current,
                  phase: "ready",
                  notice: null,
                }))
              }
            >
              进入示例取景 <ArrowRight size={18} />
            </button>
            <button
              type="button"
              className="coach-text-btn"
              onClick={onPersonal}
            >
              已有照片？进入个人图片手动对比
            </button>
          </div>
          <aside className="coach-setup-preview">
            <div className="coach-preview-caption">
              <span>本次示例</span>
              <span>原创教学图</span>
            </div>
            <FixtureScene frame={session.frame} />
            <div className="coach-preview-note">
              <h2>{scenario.description.split(" · ")[0]}</h2>
              <p>画面和建议均为内置示例，无需开启摄像头。</p>
              <div className="coach-preview-tags">
                <span>{goalLabel(context.goal)}</span>
                <span>
                  {context.device === "camera" ? "手机辅助相机" : "手机拍摄"}
                </span>
              </div>
            </div>
          </aside>
        </div>
      ) : (
        <>
          <div className="coach-session-toolbar">
            <button type="button" className="coach-text-btn" onClick={back}>
              <ArrowLeft size={16} />
              返回准备
            </button>
            <span>
              {scenario.description.split(" · ")[0]} / {goalLabel(context.goal)}
            </span>
            <button
              type="button"
              ref={referenceButton}
              className="coach-text-btn"
              onClick={() => setReference(true)}
            >
              <Eye size={16} />
              参考卡
            </button>
          </div>
          <div
            className={`coach-workspace ${comparing ? "coach-workspace-compare" : ""}`}
          >
            <div className="coach-visual-panel">
              {comparing && session.afterFrame ? (
                <CompareView session={session} />
              ) : (
                <>
                  <div className="coach-work-image">
                    <FixtureScene
                      frame={session.frame}
                      annotation={
                        annotations && guidance?.reliable && phase !== "ready"
                          ? guidance.annotation
                          : undefined
                      }
                    />
                    <span className="coach-image-badge">A · 原始示例</span>
                    {pending && (
                      <div className="coach-image-loading">
                        <LoaderCircle size={25} className="coach-spinner" />
                        <span>
                          {phase === "pending-comparison"
                            ? "正在加载示例变化"
                            : "正在读取示例建议"}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="coach-frame-footer">
                    <span>内置画面 · 不读取你的摄像头</span>
                    <button
                      type="button"
                      className="coach-text-btn"
                      aria-pressed={annotations}
                      onClick={() => setAnnotations(!annotations)}
                    >
                      <Grid2X2 size={15} />
                      标记{annotations ? "开" : "关"}
                    </button>
                  </div>
                </>
              )}
              {!comparing && (
                <p className="coach-fine coach-device-note">
                  {context.device === "camera"
                    ? `最终使用${context.cameraBody || "相机"}${context.lens ? ` / ${context.lens}` : ""}拍摄。手机示例用于观察构图和光线，不能证明相机成片的曝光或对焦。`
                    : "指导先关注机位、构图与用光。当前图示不模拟真实镜头画质。"}
                </p>
              )}
            </div>
            <section className="coach-guidance-card" aria-live="polite">
              {pending ? (
                <>
                  <span className="coach-section-number">稍等片刻</span>
                  <h2>正在加载示例</h2>
                  <button
                    type="button"
                    className="coach-secondary"
                    onClick={() => {
                      request.current?.controller.abort();
                      setSession((current) => cancelCoachRequest(current));
                    }}
                  >
                    暂停，保留进度
                  </button>
                </>
              ) : phase === "ready" ? (
                <>
                  <span className="coach-section-number">先看一眼画面</span>
                  <h2>查看拍摄建议</h2>
                  <p className="coach-muted">
                    这次的目标是“{goalLabel(context.goal)}
                    ”。读取示例后，你会获得一个可以尝试的动作。
                  </p>
                  <button
                    type="button"
                    className="coach-primary"
                    onClick={() => void run(session, "guidance")}
                  >
                    <Sparkles size={17} />
                    查看这张示例的建议
                  </button>
                  {session.notice && (
                    <button
                      type="button"
                      className="coach-text-btn"
                      onClick={() => void run(session, "guidance", "normal")}
                    >
                      重新加载正常示例
                    </button>
                  )}
                </>
              ) : phase === "guidance" && guidance ? (
                guidance.reliable ? (
                  <>
                    <span className="coach-section-number">本次只做这一步</span>
                    <p className="coach-observation">{guidance.observation}</p>
                    <h2 className="coach-action">{guidance.action}</h2>
                    <button
                      type="button"
                      className="coach-text-btn"
                      aria-expanded={showWhy ?? context.depth === "explore"}
                      onClick={() =>
                        setShowWhy(!(showWhy ?? context.depth === "explore"))
                      }
                    >
                      为什么这样做？
                      <ChevronDown size={16} />
                    </button>
                    {(showWhy ?? context.depth === "explore") && (
                      <div className="coach-explanation">
                        <p>{guidance.why}</p>
                        <p>
                          <strong>留意取舍：</strong>
                          {guidance.tradeoff}
                        </p>
                      </div>
                    )}
                    <div className="coach-next-check">
                      <span>下一步看什么</span>
                      <p>{guidance.nextCheck}</p>
                    </div>
                    <button
                      type="button"
                      className="coach-primary"
                      onClick={() =>
                        setSession((current) => ({
                          ...current,
                          phase: "adjust",
                          afterFrame: null,
                        }))
                      }
                    >
                      调整好了，选择结果 <ArrowRight size={17} />
                    </button>
                    <div className="coach-action-links">
                      <button
                        type="button"
                        className="coach-text-btn"
                        onClick={() => setCannot(!cannot)}
                      >
                        现场做不到
                      </button>
                      <button
                        type="button"
                        className="coach-text-btn"
                        disabled={!hasAlternateCoachAction(session)}
                        onClick={() =>
                          void run(
                            { ...session, alternate: !session.alternate },
                            "guidance",
                          )
                        }
                      >
                        尝试其他方案
                      </button>
                    </div>
                    {!hasAlternateCoachAction(session) && (
                      <p className="coach-fine">
                        在当前限制下，没有另一种已验证的示例动作。可以修改限制，或选择“现场做不到”保留原图。
                      </p>
                    )}
                    {cannot && (
                      <div className="coach-cannot">
                        <h3>选择可行的调整</h3>
                        <p>
                          如果位置或人物都不能调整，可以保留原图。没有变化也值得记录。
                        </p>
                        <div className="coach-chips">
                          {constraints
                            .filter((item) => item.value !== "none")
                            .map((item) => (
                              <button
                                type="button"
                                key={item.value}
                                onClick={() =>
                                  patch({ constraint: item.value })
                                }
                              >
                                {item.label}
                              </button>
                            ))}
                        </div>
                        <button
                          type="button"
                          className="coach-secondary"
                          onClick={() =>
                            setSession((current) =>
                              chooseCoachAdjustment(current, "unchanged"),
                            )
                          }
                        >
                          保留原图进行对比
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <span className="coach-section-number">
                      暂时没有可靠的下一步
                    </span>
                    <h2>重新读取或更换示例</h2>
                    <p className="coach-muted">
                      这个示例状态没有提供可用建议。你可以换一个场景，或重新读取。
                    </p>
                    <button
                      type="button"
                      className="coach-primary"
                      onClick={() => void run(session, "guidance", "normal")}
                    >
                      重新读取示例
                    </button>
                    <button
                      type="button"
                      className="coach-text-btn"
                      onClick={back}
                    >
                      返回选择场景
                    </button>
                  </>
                )
              ) : phase === "adjust" && guidance ? (
                <>
                  <span className="coach-section-number">选择调整后的示例</span>
                  <h2>选择调整结果</h2>
                  <p className="coach-muted">选择一张示例画面，再检查变化。</p>
                  <div className="coach-adjust-options">
                    {(["adjusted", "unchanged"] as const).map((variant) => {
                      const preview = chooseCoachAdjustment(
                        session,
                        variant,
                      ).afterFrame!;
                      return (
                        <button
                          type="button"
                          key={variant}
                          aria-pressed={session.afterFrame?.variant === variant}
                          onClick={() =>
                            setSession((current) =>
                              chooseCoachAdjustment(current, variant),
                            )
                          }
                        >
                          <FixtureScene frame={preview} />
                          <span>
                            {variant === "adjusted"
                              ? "尝试建议后的示例"
                              : "保持原样，没有变化"}
                          </span>
                          {session.afterFrame?.variant === variant && (
                            <Check size={16} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    className="coach-primary"
                    disabled={!session.afterFrame}
                    onClick={() => void run(session, "comparison")}
                  >
                    检查这次变化 <ArrowRight size={17} />
                  </button>
                  {session.notice && session.afterFrame && (
                    <button
                      type="button"
                      className="coach-text-btn"
                      onClick={() => void run(session, "comparison", "normal")}
                    >
                      重新加载正常对比
                    </button>
                  )}
                  <button
                    type="button"
                    className="coach-text-btn"
                    onClick={() =>
                      setSession((current) => ({
                        ...current,
                        phase: "guidance",
                      }))
                    }
                  >
                    再看一次建议
                  </button>
                </>
              ) : comparing && session.comparison ? (
                <>
                  <span className="coach-section-number">
                    {phase === "saved" ? "本次判断已记录" : "前后发生了什么"}
                  </span>
                  <h2>
                    {session.comparison.outcome === "unchanged"
                      ? "未发现明显变化"
                      : "比较调整效果"}
                  </h2>
                  <p className="coach-observation">
                    {session.comparison.changes}
                  </p>
                  <p className="coach-muted">{session.comparison.tradeoff}</p>
                  <fieldset
                    className="coach-preferences"
                    disabled={phase === "saved"}
                  >
                    <legend>你更喜欢哪种表达？</legend>
                    {(
                      [
                        { id: "before", label: "更喜欢原图" },
                        { id: "after", label: "更喜欢调整后" },
                        { id: "both", label: "两张各有优点" },
                        { id: "no-change", label: "没有明显变化" },
                        { id: "unsure", label: "暂时无法判断" },
                      ] as const
                    ).map((choice) => (
                      <button
                        type="button"
                        key={choice.id}
                        aria-pressed={session.preference === choice.id}
                        onClick={() =>
                          setSession((current) => ({
                            ...current,
                            preference: choice.id,
                          }))
                        }
                      >
                        {choice.label}
                        {session.preference === choice.id && (
                          <Check size={14} />
                        )}
                      </button>
                    ))}
                  </fieldset>
                  <label className="coach-reason">
                    记下原因 <span>可选</span>
                    <textarea
                      maxLength={200}
                      rows={2}
                      value={session.reason}
                      disabled={phase === "saved"}
                      placeholder="例如：我想保留更多旅行地点的细节"
                      onChange={(event) =>
                        setSession((current) =>
                          patchCoachReason(current, event.target.value),
                        )
                      }
                    />
                  </label>
                  {phase === "saved" ? (
                    <>
                      <div className="coach-saved">
                        <Check size={18} />
                        选择已记录，可到“我的”查看保存状态。
                      </div>
                      <button
                        type="button"
                        className="coach-primary"
                        onClick={() => setSession(createCoachSession(context))}
                      >
                        开始新的示例体验 <ArrowRight size={17} />
                      </button>
                      <button
                        type="button"
                        className="coach-text-btn"
                        onClick={() =>
                          setSession((current) => ({
                            ...current,
                            phase: "compare",
                          }))
                        }
                      >
                        修改这条记录
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="coach-primary"
                        disabled={!session.preference}
                        onClick={save}
                      >
                        保存这次判断 <Check size={17} />
                      </button>
                      <button
                        type="button"
                        className="coach-text-btn"
                        onClick={() =>
                          setSession((current) => ({
                            ...current,
                            phase: "adjust",
                            comparison: null,
                            preference: null,
                            savedAt: null,
                          }))
                        }
                      >
                        重新选择调整画面
                      </button>
                    </>
                  )}
                </>
              ) : null}
            </section>
          </div>
        </>
      )}
      {import.meta.env.DEV && (
        <details className="coach-qa">
          <summary>
            <SlidersHorizontal size={13} />
            开发验收场景
          </summary>
          <label>
            下次加载状态
            <select
              value={qaMode}
              onChange={(event) => setQaMode(event.target.value as FixtureMode)}
            >
              <option value="normal">正常示例</option>
              <option value="slow">延迟返回（4 秒）</option>
              <option value="failure">加载失败</option>
              <option value="unreliable">没有可靠建议</option>
              <option value="no-change">比较无变化</option>
            </select>
          </label>
          <p>
            这里只替换本地状态，不调用模型或设备。延迟中返回准备并修改目标，可检查旧响应是否被丢弃。
          </p>
        </details>
      )}
      {reference && (
        <div
          className="coach-modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeReference();
          }}
        >
          <section
            className="coach-reference-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="coach-reference-title"
            onKeyDown={(event) => {
              if (event.key === "Escape") closeReference();
              if (event.key === "Tab") {
                const focusable =
                  event.currentTarget.querySelectorAll<HTMLElement>(
                    "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
                  );
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first?.focus();
                }
              }
            }}
          >
            <header>
              <div>
                <h2 id="coach-reference-title">拍摄方法</h2>
              </div>
              <button
                type="button"
                ref={referenceClose}
                className="coach-icon-btn"
                aria-label="关闭参考卡，回到拍摄"
                onClick={closeReference}
              >
                <X size={20} />
              </button>
            </header>
            <p className="coach-muted">查看参考不会改变本次进度。</p>
            {STYLE_CARDS.map((card) => (
              <article key={card.id}>
                <h3>{card.title}</h3>
                <p>{card.principle}</p>
                <small>{card.tradeoff}</small>
              </article>
            ))}
            <button
              type="button"
              className="coach-primary"
              onClick={closeReference}
            >
              回到本次拍摄
            </button>
            <button
              type="button"
              className="coach-text-btn"
              onClick={() => {
                setReference(false);
                onStyles();
              }}
            >
              到学习页查看方法与练习 <ArrowRight size={16} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
