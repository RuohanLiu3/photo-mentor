import { type ReactNode } from "react";
import {
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Camera,
  CheckCircle2,
  Clock3,
  Compass,
  Focus,
  Grid3X3,
  Lightbulb,
  RotateCcw,
  Sun,
} from "lucide-react";
import Scene from "../components/Scene";
import {
  APERTURES,
  DEFAULT_SIM,
  ISOS,
  LESSONS,
  SHUTTERS,
  STYLE_CARDS,
  evaluateLesson,
  exposureDelta,
  type Goal,
  type LessonId,
  type SimSettings,
  type StyleId,
} from "../domain";
import { type SavedState } from "../storage";
import { useLocalState } from "../hooks/useLocalState";
import {
  checkLessonDraft,
  parseLessonDraft,
  resetLessonParameters,
  showLessonHint,
  updateLessonDraft,
} from "../learning";

function go(path: string) {
  window.location.hash = path;
}
function Button({
  children,
  onClick,
  kind = "primary",
  disabled = false,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`button ${kind} ${className}`}
    >
      {children}
    </button>
  );
}
function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="eyebrow">{children}</div>;
}
function SectionHeading({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <Eyebrow>{kicker}</Eyebrow>
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}
function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; title: string; detail?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="choice-field">
      <legend>{label}</legend>
      <div className="choices">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            className={`choice ${value === option.value ? "selected" : ""}`}
            onClick={() => onChange(option.value)}
          >
            <span>{option.title}</span>
            {option.detail && <small>{option.detail}</small>}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function Learn({ saved }: { saved: SavedState }) {
  return (
    <div className="page">
      <div className="page-intro">
        <h1>摄影练习</h1>
        <p>选择一节课，调整参数并观察画面变化。</p>
      </div>
      <div className="lesson-list">
        {LESSONS.map((lesson) => (
          <a
            key={lesson.id}
            href={`#/lesson/${lesson.id}`}
            className="lesson-card"
          >
            <div className={`lesson-art lesson-art-${lesson.id}`}>
              <Scene
                mode={lesson.id}
                settings={{
                  ...DEFAULT_SIM,
                  apertureIndex: lesson.id === "depth" ? 0 : 2,
                  viewpoint: lesson.id === "composition" ? 1 : 0,
                }}
                grid={lesson.id === "composition"}
              />
            </div>
            <div className="lesson-card-copy">
              <div className="card-meta">
                <span>练习 {lesson.number}</span>
                <span>
                  <Clock3 size={13} /> 约 {lesson.minutes} 分钟
                </span>
              </div>
              <h2>{lesson.title}</h2>
              <p>{lesson.description}</p>
              <div className="lesson-card-bottom">
                <span>
                  {saved.lessons[lesson.id]?.passed
                    ? "曾达成本题目标"
                    : saved.lessons[lesson.id]
                      ? `已尝试 ${saved.lessons[lesson.id]!.attempts} 次`
                      : "随时开始"}
                </span>
                <span className="round-arrow">
                  <ArrowRight size={18} />
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>
      <div className="callout">
        <Lightbulb size={20} />
        <div>
          <strong>教学示意</strong>
          <p>参数会影响运动、景深和亮度。具体选择取决于拍摄目标。</p>
        </div>
      </div>
      <div className="next-link">
        <span>已经有拍摄经验？</span>
        <a href="#/coach">
          直接打开示例指导 <ArrowRight size={16} />
        </a>
      </div>
    </div>
  );
}

export function Lesson({
  id,
  onSubmit,
  enterCoach,
}: {
  id: LessonId;
  onSubmit: (id: LessonId, passed: boolean, hint: boolean) => void;
  enterCoach: (style?: StyleId, lesson?: LessonId, goal?: Goal) => void;
}) {
  const lesson = LESSONS.find((item) => item.id === id)!;
  const [draft, setDraft, draftError] = useLocalState(
    `frame-lesson-${id}-v1`,
    parseLessonDraft,
  );
  const { sim, hint, grid } = draft;
  const feedback = draft.checked ? evaluateLesson(id, sim) : null;
  const setGrid = (value: boolean) => setDraft((d) => ({ ...d, grid: value }));
  const delta = exposureDelta(sim);
  function update<K extends keyof SimSettings>(key: K, value: SimSettings[K]) {
    setDraft((current) => updateLessonDraft(current, key, value));
  }
  function submit() {
    const result = checkLessonDraft(id, draft);
    if (result.record) onSubmit(id, result.feedback.passed, hint);
    setDraft(result.draft);
  }
  function slider(
    label: string,
    key: "shutterIndex" | "apertureIndex" | "isoIndex",
    max: number,
    value: string,
    ends: string[],
  ) {
    return (
      <div className="slider-field">
        <span>
          <label htmlFor={`lesson-${id}-${key}`}>{label}</label>
          <strong>{value}</strong>
        </span>
        <input
          id={`lesson-${id}-${key}`}
          type="range"
          min="0"
          max={max}
          step="1"
          value={sim[key]}
          aria-label={label}
          aria-valuetext={value}
          onChange={(e) => update(key, Number(e.target.value))}
        />
        <small>
          <span>{ends[0]}</span>
          <span>{ends[1]}</span>
        </small>
        <div className="frame-slider-tools">
          <button
            type="button"
            aria-label={`${label}减少一档`}
            disabled={sim[key] === 0}
            onClick={() => update(key, sim[key] - 1)}
          >
            −
          </button>
          <span>
            {sim[key] + 1} / {max + 1} 档
          </span>
          <button
            type="button"
            aria-label={`${label}增加一档`}
            disabled={sim[key] === max}
            onClick={() => update(key, sim[key] + 1)}
          >
            ＋
          </button>
        </div>
      </div>
    );
  }
  const hints = {
    motion:
      "先试 1/500 秒。保持 f/4，再将 ISO 调到 800，观察相对亮度能否回到 0 EV；之后试着找另一组参数。",
    depth:
      "想突出人物，试 f/2 或 f/2.8；想保留环境，试 f/5.6 或 f/8。本题固定焦距、对焦距离与画幅，亮度会自动补偿。",
    composition:
      "突出人物时试“侧移”：观察头部与立柱。保留环境时试“环境构图”：观察人物在整个场景中的占比。",
  };
  return (
    <div className="page">
      <a className="back-link" href="#/learn">
        <ArrowLeft size={15} /> 全部练习
      </a>
      {draftError && (
        <p role="status" className="storage-warning">
          本次练习进度暂时无法保存，仍可继续操作。
        </p>
      )}
      <div className="lesson-title">
        <div>
          <Eyebrow>练习 {lesson.number}</Eyebrow>
          <h1>{lesson.title}</h1>
        </div>
        <span className="pill">
          <Clock3 size={13} /> 约 {lesson.minutes} 分钟
        </span>
      </div>
      <div className="workspace-grid">
        <div className="simulation-panel">
          <div className="panel-toolbar">
            <span>
              <span className="status-dot" /> 参数联动示意
            </span>
            <button
              className={grid ? "active" : ""}
              aria-pressed={grid}
              onClick={() => setGrid(!grid)}
            >
              <Grid3X3 size={16} /> 参考线
            </button>
          </div>
          <Scene settings={sim} mode={id} grid={grid} />
          <div className="sim-readouts">
            {id === "motion" ? (
              <>
                <div>
                  <small>相对目标亮度</small>
                  <strong className={Math.abs(delta) < 0.35 ? "positive" : ""}>
                    {delta >= 0 ? "+" : ""}
                    {delta.toFixed(1)} <small>EV</small>
                  </strong>
                </div>
                <div>
                  <small>运动表现</small>
                  <strong>
                    {sim.shutterIndex >= 4 ? "拖影减弱" : "可见拖影"}
                  </strong>
                </div>
                <div>
                  <small>ISO 取舍</small>
                  <strong>
                    {sim.isoIndex >= 3 ? "增益 / 噪点增加" : "较低增益"}
                  </strong>
                </div>
              </>
            ) : id === "depth" ? (
              <>
                <div>
                  <small>清晰范围</small>
                  <strong>
                    {sim.apertureIndex <= 1
                      ? "更浅"
                      : sim.apertureIndex >= 3
                        ? "更深"
                        : "中等"}
                  </strong>
                </div>
                <div>
                  <small>亮度</small>
                  <strong>本题自动补偿</strong>
                </div>
              </>
            ) : (
              <>
                <div>
                  <small>当前视点</small>
                  <strong>
                    {
                      [
                        "正面 · 轮廓重叠",
                        "侧移 · 分离轮廓",
                        "环境构图 · 更多留白",
                      ][sim.viewpoint]
                    }
                  </strong>
                </div>
              </>
            )}
          </div>
          <p className="canvas-caption">
            原创示意 ·{" "}
            {id === "depth"
              ? "固定焦距、对焦距离与画幅，简化景深效果。"
              : id === "motion"
                ? "固定场景亮度；ISO 表示显示增益，不增加进光量。"
                : "三个预设视点，用于比较人物与背景的关系。"}
          </p>
        </div>
        <aside className="control-panel">
          <span className="pill soft">
            <Focus size={13} /> 本题目标
          </span>
          <h2>{id === "motion" ? "运动清晰与亮度" : "选择表达目标"}</h2>
          <p className="control-description">{lesson.objective}</p>
          {id !== "motion" && (
            <Choice
              label="表达目标"
              value={sim.depthGoal}
              options={[
                { value: "subject", title: "突出人物" },
                { value: "context", title: "保留环境" },
              ]}
              onChange={(v) => update("depthGoal", v)}
            />
          )}
          {id === "motion" &&
            slider(
              "快门速度",
              "shutterIndex",
              5,
              `1/${SHUTTERS[sim.shutterIndex]} 秒`,
              ["慢 · 更多拖影", "快 · 更少拖影"],
            )}
          {id !== "composition" &&
            slider(
              "光圈",
              "apertureIndex",
              4,
              `f/${APERTURES[sim.apertureIndex]}`,
              ["大光圈", "小光圈"],
            )}
          {id === "motion" &&
            slider("ISO", "isoIndex", 5, String(ISOS[sim.isoIndex]), [
              "低增益",
              "高增益",
            ])}
          {id === "composition" && (
            <Choice
              label="试着换个视点"
              value={String(sim.viewpoint)}
              options={[
                { value: "0", title: "正面" },
                { value: "1", title: "侧移" },
                { value: "2", title: "环境构图" },
              ]}
              onChange={(v) => update("viewpoint", Number(v))}
            />
          )}
          <div className="control-actions">
            <Button onClick={submit}>
              检查这次尝试 <ArrowRight size={16} />
            </Button>
            <div>
              <button
                onClick={() => {
                  setDraft(showLessonHint);
                }}
              >
                <Lightbulb size={15} /> 看一点提示
              </button>
              <button
                onClick={() => {
                  setDraft(resetLessonParameters);
                }}
              >
                <RotateCcw size={14} /> 重置参数
              </button>
            </div>
          </div>
          {hint && (
            <div className="hint-box">
              <strong>观察提示</strong>
              <p>{hints[id]}</p>
              <small>本轮使用过提示，会在记录中如实保留。</small>
            </div>
          )}
          {feedback && (
            <div
              role="status"
              className={`feedback ${feedback.passed ? "success" : ""}`}
            >
              <strong>
                {feedback.passed ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <Compass size={18} />
                )}
                {feedback.title}
              </strong>
              <p>{feedback.body}</p>
            </div>
          )}
        </aside>
      </div>
      <div className="lesson-transfer">
        <div>
          <h3>继续拍摄练习</h3>
          <p>将本次目标带入拍摄示例。</p>
        </div>
        <Button
          kind="secondary"
          onClick={() =>
            enterCoach(
              undefined,
              id,
              id === "motion"
                ? undefined
                : sim.depthGoal === "context"
                  ? "environment"
                  : "portrait",
            )
          }
        >
          带着目标去拍摄 <Camera size={16} />
        </Button>
      </div>
    </div>
  );
}

export function Styles({
  enterCoach,
}: {
  enterCoach: (style?: StyleId) => void;
}) {
  const symbols = [Grid3X3, Compass, Sun];
  return (
    <div className="page">
      <div className="page-intro">
        <h1>拍摄方法</h1>
        <p>选择一种观察方法，查看原理和取舍。</p>
      </div>
      <div className="style-grid">
        {STYLE_CARDS.map((card, i) => {
          const Icon = symbols[i];
          return (
            <article key={card.id} className="style-card">
              <div className={`style-illustration style-${card.id}`}>
                <Icon size={64} strokeWidth={0.8} />
                <span>0{i + 1}</span>
                <i />
                <i />
              </div>
              <div className="style-copy">
                <h2>{card.title}</h2>
                <p>{card.description}</p>
                <div className="style-principle">
                  <strong>观察线索</strong>
                  <p>{card.principle}</p>
                  <strong>也要考虑</strong>
                  <p>{card.tradeoff}</p>
                </div>
                <Button onClick={() => enterCoach(card.id)}>
                  带到拍摄示例 <ArrowRight size={15} />
                </Button>
                <Button
                  kind="ghost"
                  onClick={() => go(`/lesson/${card.lessonId}`)}
                >
                  从相关练习开始 <BookOpen size={15} />
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      <p className="fine-print">
        这里展示通用摄影方法与原创示意，尚未建立名师作品授权库，也不模拟某位摄影师本人。
      </p>
    </div>
  );
}
