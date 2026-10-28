import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Minus,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  X,
} from "lucide-react";
import Scene from "../components/Scene";
import {
  APERTURES,
  DEFAULT_SIM,
  ISOS,
  LESSONS,
  SHUTTERS,
  evaluateLesson,
  exposureDelta,
  type Goal,
  type LessonId,
} from "../domain";
import {
  CAMERA_PROFILES,
  checkSimulatorTask,
  isAutomatic,
  resolveExposureMode,
  simulatorGoal,
  simulatorSignature,
  updateSimulatorParameter,
  type BodyView,
  type ExposureMode,
  type Parameter,
  type SimulatorState,
} from "../simulator";
import "../simulator.css";

interface Props {
  state: SimulatorState;
  setState: Dispatch<SetStateAction<SimulatorState>>;
  gearName?: string;
  onCoach: (goal?: Goal, gearId?: string) => void;
  onPractice: (id: LessonId, passed: boolean, hint: boolean) => void;
}

const modeCopy: Record<ExposureMode, { name: string; body: string }> = {
  M: {
    name: "手动",
    body: "你控制快门、光圈与 ISO，观察它们如何共同改变画面。",
  },
  A: {
    name: "光圈优先",
    body: "你设置光圈与 ISO，系统在教学范围内选择快门，使亮度尽量接近目标。",
  },
  S: {
    name: "快门优先",
    body: "你设置快门与 ISO，系统在教学范围内选择光圈，使亮度尽量接近目标。",
  },
};

const parameterCopy: Record<
  Parameter,
  { title: string; hint: string; labels: string[] }
> = {
  shutterIndex: {
    title: "快门",
    hint: "向右更快 · 运动拖影更少，进光也更少",
    labels: SHUTTERS.map((value) => `1/${value}`),
  },
  apertureIndex: {
    title: "光圈",
    hint: "向右收小 · 清晰范围更大，进光更少",
    labels: APERTURES.map((value) => `f/${value}`),
  },
  isoIndex: {
    title: "ISO",
    hint: "向右提高增益 · 显示更亮，噪点可能更明显",
    labels: ISOS.map(String),
  },
};

function ParameterControl({
  parameter,
  state,
  setState,
}: Pick<Props, "state" | "setState"> & { parameter: Parameter }) {
  const copy = parameterCopy[parameter];
  const automatic = isAutomatic(parameter, state.mode);
  const value = state.settings[parameter];
  const change = (next: number) =>
    setState((current) => updateSimulatorParameter(current, parameter, next));
  return (
    <div className={`sim-control${automatic ? " sim-control-auto" : ""}`}>
      <div className="sim-control-heading">
        <label htmlFor={`sim-${parameter}`}>
          {copy.title}{" "}
          {automatic && <span className="sim-small-tag">自动</span>}
        </label>
        <output htmlFor={`sim-${parameter}`}>
          {copy.labels[value]}
          {parameter === "shutterIndex" ? " s" : ""}
        </output>
      </div>
      <div className="sim-slider-row">
        <button
          type="button"
          aria-label={`${copy.title}减少一档`}
          disabled={automatic || value === 0}
          onClick={() => change(value - 1)}
        >
          <Minus size={16} />
        </button>
        <input
          id={`sim-${parameter}`}
          type="range"
          min="0"
          max={copy.labels.length - 1}
          step="1"
          value={value}
          aria-valuetext={`${copy.title} ${copy.labels[value]}${automatic ? "，自动设置" : ""}`}
          disabled={automatic}
          onChange={(event) => change(Number(event.target.value))}
        />
        <button
          type="button"
          aria-label={`${copy.title}增加一档`}
          disabled={automatic || value === copy.labels.length - 1}
          onClick={() => change(value + 1)}
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="sim-ticks" aria-hidden="true">
        {copy.labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <p className="sim-control-hint">
        {automatic
          ? `由 ${state.mode} 模式计算；切换 M 模式可手动调整。`
          : copy.hint}
      </p>
    </div>
  );
}

type ViewfinderControl = Parameter | "mode" | "viewpoint" | "info";

function CameraViewfinder({
  state,
  setState,
  onReset,
}: Pick<Props, "state" | "setState"> & { onReset: () => void }) {
  const [active, setActive] = useState<ViewfinderControl | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const viewfinder = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const focusManualControl = useRef(false);
  const lesson = LESSONS.find((item) => item.id === state.lessonId)!;
  const delta = exposureDelta(state.settings);
  const autoAtLimit = state.mode !== "M" && Math.abs(delta) > 0.35;
  const parameter =
    active && active in parameterCopy ? (active as Parameter) : null;
  const titles = { mode: "曝光模式", viewpoint: "取景视点", info: "参数说明" };
  const title = parameter
    ? parameterCopy[parameter].title
    : active
      ? titles[active as keyof typeof titles]
      : "";
  const viewpoints = ["原始视点", "侧移视点", "环境视点"];
  const close = () => {
    setActive(null);
    trigger.current?.focus({ preventScroll: true });
  };
  const toggle = (control: ViewfinderControl, button: HTMLButtonElement) => {
    trigger.current = button;
    setActive((current) => (current === control ? null : control));
  };
  useEffect(() => {
    if (!active) return;
    if (
      viewfinder.current &&
      viewfinder.current.getBoundingClientRect().top < 0
    ) {
      viewfinder.current.scrollIntoView({
        block: "start",
        behavior: "instant",
      });
    }
    panel.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
    panel.current?.focus({ preventScroll: true });
  }, [active]);
  useEffect(() => {
    if (state.mode === "M" && focusManualControl.current) {
      focusManualControl.current = false;
      panel.current
        ?.querySelector<HTMLInputElement>('input[type="range"]')
        ?.focus({ preventScroll: true });
    }
  }, [state.mode]);
  useEffect(() => {
    setActive(null);
  }, [state.lessonId]);

  return (
    <section
      ref={viewfinder}
      className={`sim-preview${active ? " sim-preview-editing" : ""}`}
      aria-labelledby="sim-preview-title"
      onKeyDown={(event) => {
        if (event.key === "Escape" && active) {
          event.preventDefault();
          close();
        }
      }}
    >
      <div className="sim-preview-top">
        <span id="sim-preview-title">{lesson.title}</span>
        <button
          type="button"
          aria-pressed={state.grid}
          onClick={() =>
            setState((current) => ({ ...current, grid: !current.grid }))
          }
        >
          {state.grid ? "隐藏辅助线" : "显示辅助线"}
        </button>
      </div>
      <Scene
        mode={state.lessonId}
        settings={state.settings}
        grid={state.grid}
      />
      <div
        className="sim-camera-readout sim-camera-controls"
        aria-label="相机参数，点击调节"
      >
        <button
          type="button"
          aria-label={`曝光模式 ${state.mode} ${modeCopy[state.mode].name}，点击调节`}
          aria-expanded={active === "mode"}
          aria-controls="sim-viewfinder-panel"
          onClick={(event) => toggle("mode", event.currentTarget)}
        >
          <span>
            模式 <ChevronDown size={11} />
          </span>
          <strong>
            {state.mode} <small>{modeCopy[state.mode].name}</small>
          </strong>
        </button>
        {(["shutterIndex", "apertureIndex", "isoIndex"] as const).map((key) => {
          const copy = parameterCopy[key];
          const automatic = isAutomatic(key, state.mode);
          const value =
            copy.labels[state.settings[key]] +
            (key === "shutterIndex" ? " s" : "");
          return (
            <button
              type="button"
              key={key}
              aria-label={`${copy.title} ${value}${automatic ? "，自动" : ""}，点击调节`}
              aria-expanded={active === key}
              aria-controls="sim-viewfinder-panel"
              onClick={(event) => toggle(key, event.currentTarget)}
            >
              <span>
                {copy.title}{" "}
                {automatic ? <small>自动</small> : <ChevronDown size={11} />}
              </span>
              <strong>{value}</strong>
            </button>
          );
        })}
      </div>
      <div className="sim-viewfinder-utilities">
        <span
          className={autoAtLimit ? "sim-viewfinder-limit" : ""}
          aria-live="polite"
        >
          {state.lessonId === "motion" ? "相对亮度" : "亮度计算值"}{" "}
          <strong>
            {delta >= 0 ? "+" : ""}
            {delta.toFixed(1)} EV
          </strong>
        </span>
        {state.lessonId === "composition" && (
          <button
            type="button"
            aria-expanded={active === "viewpoint"}
            aria-controls="sim-viewfinder-panel"
            onClick={(event) => toggle("viewpoint", event.currentTarget)}
          >
            视点 · {viewpoints[state.settings.viewpoint]}{" "}
            <ChevronDown size={12} />
          </button>
        )}
        <button
          type="button"
          aria-expanded={active === "info"}
          aria-controls="sim-viewfinder-panel"
          onClick={(event) => toggle("info", event.currentTarget)}
        >
          说明
        </button>
        <button type="button" aria-label="重置当前参数" onClick={onReset}>
          <RotateCcw size={14} />
          <span>重置</span>
        </button>
      </div>
      {active && (
        <div
          ref={panel}
          id="sim-viewfinder-panel"
          className="sim-viewfinder-panel"
          role="region"
          aria-label={`${title}调节`}
          tabIndex={-1}
        >
          <div className="sim-viewfinder-panel-heading">
            <h3>{title}</h3>
            <button type="button" aria-label="完成参数调节" onClick={close}>
              <Check size={15} />
              完成
            </button>
          </div>
          {active === "mode" && (
            <>
              <div className="sim-mode-selector" aria-label="曝光模式">
                {CAMERA_PROFILES[0].modes.map((mode) => (
                  <button
                    type="button"
                    key={mode}
                    aria-pressed={state.mode === mode}
                    onClick={() =>
                      setState((current) => ({
                        ...current,
                        mode,
                        settings: resolveExposureMode(current.settings, mode),
                      }))
                    }
                  >
                    <b>{mode}</b>
                    <span>{modeCopy[mode].name}</span>
                  </button>
                ))}
              </div>
              <p className="sim-control-hint">{modeCopy[state.mode].body}</p>
            </>
          )}
          {parameter && (
            <>
              <ParameterControl
                parameter={parameter}
                state={state}
                setState={setState}
              />
              {isAutomatic(parameter, state.mode) && (
                <button
                  type="button"
                  className="sim-viewfinder-manual"
                  onClick={() => {
                    focusManualControl.current = true;
                    setState((current) => ({ ...current, mode: "M" }));
                  }}
                >
                  切换 M 模式，手动调节{parameterCopy[parameter].title}
                </button>
              )}
              {state.lessonId !== "motion" && (
                <p className="sim-control-hint">
                  此场景只显示{state.lessonId === "depth" ? "景深" : "构图"}
                  变化，显示亮度保持补偿。
                </p>
              )}
            </>
          )}
          {active === "viewpoint" && (
            <div className="sim-viewpoints" aria-label="预设视点">
              {viewpoints.map((name, idx) => (
                <button
                  type="button"
                  key={name}
                  aria-pressed={state.settings.viewpoint === idx}
                  onClick={() =>
                    setState((current) => ({
                      ...current,
                      settings: { ...current.settings, viewpoint: idx },
                    }))
                  }
                >
                  {name}
                </button>
              ))}
            </div>
          )}
          {active === "info" && (
            <div className="sim-viewfinder-info">
              <p>
                点击取景框下方的模式或数值，即可调节。改动会即时反映在示意画面中。
              </p>
              <p>
                ISO 保持手动；A / S 使用当前范围内最接近 0 EV
                的一档。真实相机的测光、对焦、镜头与自动 ISO 规则需按型号核实。
              </p>
              {state.lessonId !== "motion" && (
                <p>
                  此场景只显示{state.lessonId === "depth" ? "景深" : "构图"}
                  变化。其他曝光参数仍会联动，但不改变本场景显示亮度；切到运动场景可观察亮度变化。
                </p>
              )}
            </div>
          )}
        </div>
      )}
      {autoAtLimit && (
        <p className="sim-viewfinder-warning" role="status">
          自动参数已到教学范围边界，尚不能匹配目标亮度。试着改变 ISO
          或当前手动参数。
        </p>
      )}
    </section>
  );
}

function CameraBody({ state, setState }: Pick<Props, "state" | "setState">) {
  const profile = CAMERA_PROFILES[0];
  const visible = profile.hotspots.filter(
    (hotspot) => hotspot.locations[state.bodyView],
  );
  const selected =
    visible.find((hotspot) => hotspot.id === state.hotspotId) ?? visible[0];
  const switchView = (view: BodyView) =>
    setState((current) => ({
      ...current,
      bodyView: view,
      hotspotId: profile.hotspots.find((hotspot) => hotspot.locations[view])!
        .id,
    }));
  return (
    <section
      className="sim-card sim-body-card"
      aria-labelledby="sim-body-heading"
    >
      <div className="sim-section-heading">
        <div>
          <h2 id="sim-body-heading">机身按键</h2>
        </div>
        <span className="sim-small-tag">通用示意</span>
      </div>
      <div className="sim-segments sim-body-tabs" aria-label="机身视图">
        {(["front", "back", "top"] as const).map((view) => (
          <button
            type="button"
            key={view}
            aria-pressed={state.bodyView === view}
            onClick={() => switchView(view)}
          >
            {{ front: "正面", back: "背面", top: "顶部" }[view]}
          </button>
        ))}
      </div>
      <div className="sim-camera-illustration">
        <svg
          viewBox="0 0 400 260"
          role="img"
          aria-label={`通用教学相机${{ front: "正面", back: "背面", top: "顶部" }[state.bodyView]}示意图`}
        >
          <defs>
            <linearGradient id="sim-camera-metal" x2="0" y2="1">
              <stop stopColor="#45594f" />
              <stop offset="1" stopColor="#1c3228" />
            </linearGradient>
          </defs>
          <ellipse
            cx="202"
            cy="230"
            rx="151"
            ry="10"
            fill="#1c3228"
            opacity=".09"
          />
          {state.bodyView !== "top" ? (
            <>
              <path
                d="M43 70Q43 51 62 51H133L149 31H217L233 51H336Q356 51 356 74V206Q356 222 340 222H60Q43 222 43 205Z"
                fill="url(#sim-camera-metal)"
                stroke="#13261d"
                strokeWidth="2"
              />
              <rect
                x="288"
                y="70"
                width="53"
                height="133"
                rx="16"
                fill="#172c21"
              />
              <rect
                x="158"
                y="42"
                width="49"
                height="23"
                rx="5"
                fill="#12241b"
              />
              {state.bodyView === "front" ? (
                <>
                  <circle
                    cx="200"
                    cy="150"
                    r="81"
                    fill="#516058"
                    stroke="#a0a89c"
                    strokeWidth="3"
                  />
                  <circle
                    cx="200"
                    cy="150"
                    r="66"
                    fill="#17281e"
                    stroke="#0f1c15"
                    strokeWidth="6"
                  />
                  <circle
                    cx="200"
                    cy="150"
                    r="45"
                    fill="#304a48"
                    stroke="#527568"
                    strokeWidth="3"
                  />
                  <circle cx="200" cy="150" r="27" fill="#102b2b" />
                  <ellipse
                    cx="189"
                    cy="135"
                    rx="17"
                    ry="10"
                    fill="#a2c8b7"
                    opacity=".3"
                  />
                  <text
                    x="63"
                    y="86"
                    fontSize="13"
                    fill="#dddcca"
                    letterSpacing="2"
                  >
                    FRAME
                  </text>
                  <rect
                    x="292"
                    y="59"
                    width="33"
                    height="9"
                    rx="4"
                    fill="#a4a899"
                  />
                </>
              ) : (
                <>
                  <rect
                    x="65"
                    y="93"
                    width="211"
                    height="112"
                    rx="6"
                    fill="#111f17"
                    stroke="#809184"
                  />
                  <rect
                    x="72"
                    y="101"
                    width="197"
                    height="95"
                    rx="2"
                    fill="#9fab96"
                  />
                  <path
                    d="M72 175L111 134L148 155L198 117L269 180V196H72Z"
                    fill="#6a8476"
                  />
                  <circle cx="226" cy="125" r="12" fill="#e4d4ad" />
                  <rect
                    x="299"
                    y="57"
                    width="34"
                    height="17"
                    rx="6"
                    fill="#718176"
                  />
                  <circle
                    cx="317"
                    cy="151"
                    r="21"
                    fill="#476151"
                    stroke="#96a28f"
                  />
                  <circle cx="317" cy="151" r="9" fill="#192e21" />
                </>
              )}
            </>
          ) : (
            <>
              <path
                d="M51 72Q51 49 72 49H328Q350 49 350 71V199H51Z"
                fill="url(#sim-camera-metal)"
                stroke="#13261d"
                strokeWidth="2"
              />
              <rect
                x="151"
                y="24"
                width="99"
                height="61"
                rx="13"
                fill="#34483c"
                stroke="#81907e"
              />
              <rect
                x="167"
                y="12"
                width="67"
                height="29"
                rx="4"
                fill="#172b20"
              />
              <rect
                x="287"
                y="67"
                width="46"
                height="96"
                rx="15"
                fill="#182e22"
              />
              <circle
                cx="100"
                cy="117"
                r="37"
                fill="#1c3025"
                stroke="#9da58f"
                strokeWidth="3"
              />
              <path
                d="M100 80V91M137 117H126M100 154V143M63 117H75"
                stroke="#c6c8b5"
                strokeWidth="2"
              />
              <text
                x="162"
                y="144"
                fontSize="12"
                fill="#c6c8b5"
                letterSpacing="2"
              >
                FRAME
              </text>
              <rect
                x="291"
                y="176"
                width="45"
                height="11"
                rx="3"
                fill="#718176"
              />
            </>
          )}
        </svg>
        {visible.map((hotspot, idx) => {
          const location = hotspot.locations[state.bodyView]!;
          return (
            <button
              type="button"
              className={`sim-hotspot${selected.id === hotspot.id ? " sim-hotspot-selected" : ""}`}
              key={hotspot.id}
              aria-label={`${hotspot.title}：查看操作说明`}
              aria-pressed={selected.id === hotspot.id}
              style={{ left: `${location.x}%`, top: `${location.y}%` }}
              onClick={() =>
                setState((current) => ({ ...current, hotspotId: hotspot.id }))
              }
            >
              {idx + 1}
            </button>
          );
        })}
      </div>
      <div className="sim-hotspot-list">
        {visible.map((hotspot, idx) => (
          <button
            type="button"
            key={hotspot.id}
            aria-pressed={selected.id === hotspot.id}
            onClick={() =>
              setState((current) => ({ ...current, hotspotId: hotspot.id }))
            }
          >
            <span>{idx + 1}</span>
            {hotspot.short}
          </button>
        ))}
      </div>
      <div className="sim-hotspot-copy" aria-live="polite">
        <h3>{selected.title}</h3>
        <p>{selected.description}</p>
      </div>
    </section>
  );
}

export default function SimulatorPage({
  state,
  setState,
  gearName,
  onCoach,
  onPractice,
}: Props) {
  const [chooserOpen, setChooserOpen] = useState(false);
  const [modelDraft, setModelDraft] = useState(state.requestedModel);
  const [checkedSignature, setCheckedSignature] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const modelButton = useRef<HTMLButtonElement>(null);
  const lesson = LESSONS.find((item) => item.id === state.lessonId)!;
  const feedback = evaluateLesson(state.lessonId, state.settings);
  const signature = simulatorSignature(state);

  useEffect(() => {
    if (chooserOpen && !dialog.current?.open) dialog.current?.showModal();
    else if (!chooserOpen && dialog.current?.open) dialog.current.close();
  }, [chooserOpen]);

  const closeChooser = () => {
    setChooserOpen(false);
    modelButton.current?.focus();
  };
  const changeLesson = (lessonId: LessonId) =>
    setState((current) => ({
      ...current,
      lessonId,
      taskHintSeen: false,
    }));
  const checkTask = () => {
    const result = checkSimulatorTask(state);
    if (result.record) {
      onPractice(state.lessonId, result.feedback.passed, state.taskHintSeen);
      setState(result.state);
    }
    setCheckedSignature(signature);
  };

  return (
    <div className="sim-page">
      <header className="sim-page-heading">
        <div>
          <h1>相机模拟器</h1>
          <p>调整参数、认识按键，或完成一项练习。</p>
        </div>
        <span className="sim-source">原创教学示意</span>
      </header>
      <div className="sim-model-bar">
        <div>
          <span className="sim-eyebrow">当前练习配置</span>
          <h2>{CAMERA_PROFILES[0].name}</h2>
          <p>
            {gearName
              ? `从「${gearName}」进入 · 使用通用教学配置`
              : "通用教学配置 · 支持 M / A / S 模式"}
          </p>
        </div>
        <button
          ref={modelButton}
          type="button"
          className="sim-outline"
          onClick={() => {
            setModelDraft(state.requestedModel);
            setChooserOpen(true);
          }}
        >
          选择机型
          <ChevronDown size={16} />
        </button>
      </div>
      {state.requestedModel && (
        <div className="sim-note">
          “{state.requestedModel}
          ”尚未校对操作资料。当前继续使用通用教学相机，不代表该型号的按键、菜单或成像。
        </div>
      )}

      <div className="sim-workspace">
        <div className="sim-preview-column">
          <CameraViewfinder
            state={state}
            setState={setState}
            onReset={() => {
              setState((current) => ({
                ...current,
                settings: resolveExposureMode(
                  { ...DEFAULT_SIM, depthGoal: current.settings.depthGoal },
                  current.mode,
                ),
              }));
              setCheckedSignature(null);
            }}
          />
          <p className="sim-caption">
            {state.lessonId === "motion"
              ? "固定光线的运动示意，亮度与噪点为教学近似。"
              : state.lessonId === "depth"
                ? "景深示意固定焦距、对焦距离和画幅，并补偿显示亮度。"
                : "三种预设视点，仅演示人物与背景的构图关系。"}{" "}
            不复现具体机型画质。
          </p>
          <CameraBody state={state} setState={setState} />
        </div>

        <div className="sim-controls-column">
          <section className="sim-card" aria-labelledby="sim-controls-heading">
            <div className="sim-section-heading">
              <h2 id="sim-controls-heading">练习设置</h2>
              <SlidersHorizontal size={20} />
            </div>
            <div className="sim-segments" aria-label="练习方式">
              <button
                type="button"
                aria-pressed={state.activity === "free"}
                onClick={() =>
                  setState((current) => ({ ...current, activity: "free" }))
                }
              >
                自由体验
              </button>
              <button
                type="button"
                aria-pressed={state.activity === "task"}
                onClick={() =>
                  setState((current) => ({ ...current, activity: "task" }))
                }
              >
                跟着任务练习
              </button>
            </div>
            <label className="sim-field-label" htmlFor="sim-scene">
              练习场景
            </label>
            <select
              id="sim-scene"
              className="sim-select"
              value={state.lessonId}
              onChange={(event) => changeLesson(event.target.value as LessonId)}
            >
              {LESSONS.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.title}
                  {state.completedTasks.includes(item.id)
                    ? " · 已达成本题目标"
                    : ""}
                </option>
              ))}
            </select>
            {state.lessonId !== "motion" && (
              <>
                <span className="sim-field-label">这次想表达什么？</span>
                <div className="sim-segments" aria-label="练习目标">
                  {(["subject", "context"] as const).map((goal) => (
                    <button
                      type="button"
                      key={goal}
                      aria-pressed={state.settings.depthGoal === goal}
                      onClick={() =>
                        setState((current) => ({
                          ...current,
                          settings: { ...current.settings, depthGoal: goal },
                        }))
                      }
                    >
                      {goal === "subject" ? "突出人物" : "保留环境"}
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>

          {state.activity === "task" && (
            <section className="sim-task" aria-labelledby="sim-task-title">
              <span className="sim-eyebrow">练习任务</span>
              <h2 id="sim-task-title">{lesson.title}</h2>
              <p>{lesson.objective}</p>
              <div className="sim-task-actions">
                <button
                  type="button"
                  className="sim-primary"
                  onClick={checkTask}
                >
                  {state.lastRecordedSignature === signature
                    ? "查看这次检查"
                    : "检查这次练习"}
                  <ArrowRight size={16} />
                </button>
                <button
                  type="button"
                  className="sim-text-button"
                  onClick={() =>
                    setState((current) => ({
                      ...current,
                      taskHintSeen: true,
                    }))
                  }
                >
                  查看提示
                </button>
              </div>
              {state.taskHintSeen && (
                <p className="sim-hint">{feedback.body}</p>
              )}
              {checkedSignature === signature && (
                <div
                  className={`sim-feedback${feedback.passed ? " sim-feedback-passed" : ""}`}
                  role="status"
                >
                  <h3>
                    {feedback.passed && <Check size={18} />} {feedback.title}
                  </h3>
                  <p>{feedback.body}</p>
                  <small>
                    本地规则检查，结果已加入本轮练习记录。
                    {state.taskHintSeen
                      ? "这次使用了提示。"
                      : "这次未查看提示。"}
                  </small>
                </div>
              )}
              <p className="sim-task-progress">
                {state.completedTasks.length}/3 项任务曾达成本题目标 ·
                不代表实拍掌握程度
              </p>
            </section>
          )}
          <section className="sim-next">
            <div>
              <h2>继续拍摄练习</h2>
              <p>保留本次目标与器材选择，进入手机指导示例。</p>
            </div>
            <button
              type="button"
              className="sim-primary"
              onClick={() =>
                onCoach(simulatorGoal(state), state.gearId ?? undefined)
              }
            >
              进入拍摄示例
              <ArrowRight size={18} />
            </button>
          </section>
        </div>
      </div>

      <dialog
        className="sim-model-dialog"
        ref={dialog}
        onCancel={closeChooser}
        onClose={() => {
          setChooserOpen(false);
          modelButton.current?.focus();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeChooser();
        }}
        aria-labelledby="sim-model-title"
      >
        <div className="sim-dialog-inner">
          <div className="sim-section-heading">
            <div>
              <h2 id="sim-model-title">选择练习机型</h2>
            </div>
            <button
              type="button"
              className="sim-icon-button"
              aria-label="关闭机型选择"
              onClick={closeChooser}
            >
              <X size={20} />
            </button>
          </div>
          <p>目前可使用通用教学相机练习。</p>
          <div className="sim-model-option">
            <span className="sim-small-tag">可练习 · 原创教学配置</span>
            <h3>{CAMERA_PROFILES[0].name}</h3>
            <p>{CAMERA_PROFILES[0].description}</p>
            <div className="sim-model-chips">
              <span>3 种曝光模式</span>
              <span>3 个场景</span>
              <span>3 面机身视图</span>
            </div>
            <button
              type="button"
              className="sim-primary"
              onClick={closeChooser}
            >
              使用通用教学相机
              <ArrowRight size={16} />
            </button>
          </div>
          <div className="sim-model-request">
            <h3>记录想练习的型号</h3>
            <p>
              具体型号还在等待说明书与行为校对。填写只保留在本机，不会联网提交，也不会开启该型号模拟。
            </p>
            <label className="sim-field-label" htmlFor="sim-model-request">
              相机型号（可选）
            </label>
            <input
              id="sim-model-request"
              type="text"
              value={modelDraft}
              maxLength={80}
              placeholder="填写你的机身型号"
              onChange={(event) => setModelDraft(event.target.value)}
            />
            <button
              type="button"
              className="sim-outline"
              onClick={() => {
                setState((current) => ({
                  ...current,
                  requestedModel: modelDraft.trim().slice(0, 80),
                }));
                closeChooser();
              }}
            >
              保存型号，继续通用练习
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
