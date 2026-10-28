export type LessonId = "motion" | "depth" | "composition";
export type Device = "phone" | "camera" | "unknown";
export type Goal = "portrait" | "environment" | "creative";
export type StyleId = "none" | "geometry" | "environment" | "light";
export type FeedbackDepth = "simple" | "explore";
/** The named participant cannot move: camera = fixed viewpoint, subject = fixed subject. */
export type Constraint = "none" | "camera" | "subject";
export type Strategy = "subject" | "context";

export interface SimSettings {
  shutterIndex: number;
  apertureIndex: number;
  isoIndex: number;
  viewpoint: number;
  depthGoal: "subject" | "context";
}

export const SHUTTERS = [30, 60, 125, 250, 500, 1000] as const;
export const APERTURES = [2, 2.8, 4, 5.6, 8] as const;
export const ISOS = [100, 200, 400, 800, 1600, 3200] as const;
export const DEFAULT_SIM: SimSettings = {
  shutterIndex: 2,
  apertureIndex: 2,
  isoIndex: 1,
  viewpoint: 0,
  depthGoal: "subject",
};

interface Lesson {
  id: LessonId;
  title: string;
  description: string;
  objective: string;
  minutes: number;
  number: string;
}

export const LESSONS: readonly Lesson[] = [
  {
    id: "motion",
    number: "01",
    title: "把运动留在瞬间",
    minutes: 4,
    description: "亲手调整快门、光圈与 ISO，看清运动和亮度的取舍。",
    objective: "在这个固定光线的模拟场景里，让运动主体清楚，并保持目标亮度。",
  },
  {
    id: "depth",
    number: "02",
    title: "让视线找到主角",
    minutes: 3,
    description: "比较不同光圈下的清晰范围，为你的表达选择景深。",
    objective: "在焦距、对焦距离和画幅固定的示意中，选择符合目标的清晰范围。",
  },
  {
    id: "composition",
    number: "03",
    title: "换一个角度看",
    minutes: 3,
    description: "比较三个预设视点，处理人物与背景的关系。",
    objective: "根据突出人物或保留环境的目标，选择合适的示意视点。",
  },
];

interface StyleCard {
  id: Exclude<StyleId, "none">;
  title: string;
  description: string;
  principle: string;
  tradeoff: string;
  lessonId: LessonId;
}

/** Original teaching cards; these are not attributed to a photographer or master work. */
export const STYLE_CARDS: readonly StyleCard[] = [
  {
    id: "geometry",
    title: "几何关系",
    lessonId: "composition",
    description: "用线条、形状与人物的位置，组织画面的秩序。",
    principle:
      "先找背景中的线条，再观察它们与主体轮廓的关系；三分法只是可选工具。",
    tradeoff: "几何秩序可能减少随意感，过度追求对齐也可能错过表情。",
  },
  {
    id: "environment",
    title: "环境叙事",
    lessonId: "depth",
    description: "保留能说明地点和故事的细节，让环境参与表达。",
    principle: "决定哪个环境元素与主题有关，再平衡主体占比和背景可读性。",
    tradeoff: "更多环境信息会分散注意力，需要更仔细地安排人物位置。",
  },
  {
    id: "light",
    title: "明暗层次",
    lessonId: "motion",
    description: "观察亮面与阴影，用光线引导视线。",
    principle: "先决定希望观众看见什么，再观察它与周围明暗的关系。",
    tradeoff: "更强的明暗对比可能减少暗部细节，未必适合每一种表达。",
  },
];

function boundedIndex(value: number, length: number, fallback: number): number {
  return Number.isFinite(value)
    ? Math.max(0, Math.min(length - 1, Math.round(value)))
    : fallback;
}

function normalized(settings: SimSettings): SimSettings {
  return {
    shutterIndex: boundedIndex(
      settings.shutterIndex,
      SHUTTERS.length,
      DEFAULT_SIM.shutterIndex,
    ),
    apertureIndex: boundedIndex(
      settings.apertureIndex,
      APERTURES.length,
      DEFAULT_SIM.apertureIndex,
    ),
    isoIndex: boundedIndex(
      settings.isoIndex,
      ISOS.length,
      DEFAULT_SIM.isoIndex,
    ),
    viewpoint: boundedIndex(settings.viewpoint, 3, DEFAULT_SIM.viewpoint),
    depthGoal: settings.depthGoal === "context" ? "context" : "subject",
  };
}

export function goalLabel(goal: Goal): string {
  return {
    portrait: "突出人物",
    environment: "保留环境",
    creative: "探索新拍法",
  }[goal];
}

/**
 * Teaching approximation of displayed brightness relative to 1/125, f/4, ISO 200.
 * Aperture labels are rounded, but adjacent indices represent exact full stops:
 * N(index) = 2 * sqrt(2)^index. The ISO term is signal/display gain, not more photons.
 * Actual nominal shutter durations are used, so 1/60 to 1/125 is about 1.06 stops.
 */
export function exposureDelta(settings: SimSettings): number {
  const current = normalized(settings);
  const shutterStops = Math.log2(125 / SHUTTERS[current.shutterIndex]);
  const apertureStops = 2 - current.apertureIndex;
  const gainStops = Math.log2(ISOS[current.isoIndex] / 200);
  return shutterStops + apertureStops + gainStops;
}

export interface LessonFeedback {
  passed: boolean;
  title: string;
  body: string;
}

export function evaluateLesson(
  id: LessonId,
  settings: SimSettings,
): LessonFeedback {
  const current = normalized(settings);
  if (id === "motion") {
    if (SHUTTERS[current.shutterIndex] < 500) {
      return {
        passed: false,
        title: "先试着缩短曝光时间",
        body: "这个练习中的主体移动较快。试试 1/500 秒或更快，观察拖影变化；这个起点只适用于当前模拟场景。",
      };
    }
    const delta = exposureDelta(current);
    if (delta < -0.35) {
      return {
        passed: false,
        title: "运动清楚了，再找回亮度",
        body: "更快的快门减少了进光。保持快门，试着开大光圈或提高 ISO，让相对亮度接近 0 EV。ISO 增益不会增加到达传感器的光子数。",
      };
    }
    if (delta > 0.35) {
      return {
        passed: false,
        title: "再收回一点亮度",
        body: "当前显示亮度高于本练习目标。保持主体清楚，试着降低 ISO 或收小光圈，让相对亮度接近 0 EV。",
      };
    }
    return {
      passed: true,
      title: "达成本题目标",
      body: "你在这个模拟场景中兼顾了运动清晰与目标亮度。不同参数仍会带来景深和噪点的取舍；完成这题不等于已经掌握所有实拍场景。",
    };
  }

  if (id === "depth") {
    const subject = current.depthGoal === "subject";
    const passed = subject
      ? current.apertureIndex <= 1
      : current.apertureIndex >= 3;
    return {
      passed,
      title: passed
        ? "清晰范围符合本题目标"
        : subject
          ? "试着缩小清晰范围"
          : "试着让更多环境清楚",
      body: subject
        ? "本示意固定焦距、主体距离、对焦点和画幅，并补偿显示亮度。f/2–f/2.8 对应本题的主体分离目标；实拍时主体与背景的距离也会影响虚化。"
        : "本示意固定焦距、主体距离、对焦点和画幅，并补偿显示亮度。f/5.6–f/8 对应本题保留环境的目标；实拍还要重新考虑快门与 ISO 的配合。",
    };
  }

  const subject = current.depthGoal === "subject";
  const passed = subject ? current.viewpoint === 1 : current.viewpoint === 2;
  return {
    passed,
    title: passed ? "视点符合本题意图" : "再比较一下人物与背景",
    body: subject
      ? "在这组预设示意中，侧移视点让人物与背景线条分开。观察头部轮廓与画面边缘；它是本场景的一种解法，不是通用的构图标准。"
      : "在这组预设示意中，环境构图示意保留了更多环境关系。观察环境是否帮助讲述地点，同时留意新的背景重叠；环境更多不一定适合所有照片。",
  };
}

export interface GuidanceAction {
  id: string;
  title: string;
  body: string;
  reason: string;
  tradeoff: string;
}

export interface DemoGuidanceOptions {
  goal: Goal;
  device: Device;
  depth: FeedbackDepth;
  style: StyleId;
  strategy: Strategy;
  constraint: Constraint;
}

export interface DemoGuidance {
  title: string;
  actions: GuidanceAction[];
  deviceNote: string;
  goalLabel: string;
}

function primaryAction(options: DemoGuidanceOptions): GuidanceAction {
  const { goal, strategy, constraint } = options;
  const context = strategy === "context";
  const name =
    goal === "environment"
      ? "环境中的人物"
      : goal === "creative"
        ? "新的视觉关系"
        : "人物的视觉重点";
  const intent = context ? "让人物和环境共同表达" : "先让视线找到人物";
  if (constraint === "camera") {
    return {
      id: "fixed-camera",
      title: context
        ? "机位固定，调整人物与环境的关系"
        : "机位固定，让人物避开背景线条",
      body: context
        ? "在示例中请人物小幅侧移，让身体与背景线条错开，同时留出能交代地点的区域。先看人物与环境的关系，再拍一张。"
        : "在示例中请人物小幅侧移，直到头部轮廓与背景线条分开。保持相机位置，比较人物轮廓是否更容易辨认。",
      reason: `${intent}，服务于你选择的“${goalLabel(goal)}”；本次优先观察${name}。`,
      tradeoff:
        "人物的新位置可能改变面部光线和姿态；如果人物也无法移动，先保留现状，再考虑有限的裁切。",
    };
  }
  if (constraint === "subject") {
    return {
      id: "fixed-subject",
      title: context
        ? "主体固定，用取景保留环境"
        : "主体固定，小幅改变观察角度",
      body: context
        ? "保持人物位置，在示例中试着稍微后退或使用已有的较广视角，将窗框、桌面和地面线条一起纳入画面。"
        : "保持人物位置，在允许的空间内小幅侧移相机，观察头部与背景线条是否分开，再重新取景。",
      reason: `${intent}，通过观察角度处理${name}，保留当前人物状态。`,
      tradeoff: context
        ? "人物在画面中会更小，边缘也可能出现新的干扰。"
        : "新角度可能改变脸部透视和背景，需要再检查画面边缘。",
    };
  }
  return {
    id: `${goal}-${strategy}`,
    title:
      goal === "creative"
        ? context
          ? "试一张让环境参与的画面"
          : "试一张人物更突出的画面"
        : context
          ? "留出能说明地点的空间"
          : "小幅侧移，让轮廓更清楚",
    body: context
      ? "在这张示例中，尝试稍微后退，让人物、窗框和桌面形成关系。保留能说明环境的部分，再检查画面边缘。"
      : "在这张示例中，小幅横移机位，观察人物头部与背景线条分开的位置。先改变一个因素，再拍一张比较。",
    reason: `${intent}。你选择的“${goalLabel(goal)}”决定这一版优先探索${name}。`,
    tradeoff: context
      ? "环境信息增加后，人物的视觉占比会下降。"
      : "背景可能更干净，也可能减少地点信息。",
  };
}

function styleAction(options: DemoGuidanceOptions): GuidanceAction {
  const { style, goal, constraint, strategy } = options;
  if (style === "geometry") {
    return {
      id: "style-geometry",
      title: "给线条与人物留一点间隔",
      body:
        constraint === "camera"
          ? "保持机位，在示例中请人物稍微调整站位，比较背景线条从身体后方穿过与落在身旁的差别。"
          : "观察示例中的背景线条，微调相机方向，让线条与人物轮廓形成明确关系；调整后检查水平与边缘。",
      reason:
        "几何关系卡关注轮廓、线条和负空间；不要求把人物固定在某条三分线上。",
      tradeoff: "更规整的构图可能减少自然随意的感觉。",
    };
  }
  if (style === "environment") {
    return {
      id: "style-environment",
      title: "为画面留下一个地点线索",
      body:
        constraint === "camera"
          ? "保持机位，在现有示例画面中选择窗框或小桌面作为环境线索；可以请人物侧移，避免把这个线索完全挡住。"
          : strategy === "subject"
            ? "在示例取景中保留一小块可辨认的窗框或桌面，让人物仍是重点，同时留下一点环境信息。"
            : "在示例中稍微放宽取景，保留窗框、立柱和地面的连接，检查它们是否帮助说明人物所在的位置。",
      reason: "环境叙事关注与主题有关的信息，而不是把所有背景都留下。",
      tradeoff: "保留的细节越多，越需要检查它们有没有抢走主体的注意力。",
    };
  }
  if (style === "light") {
    return {
      id: "style-light",
      title: "比较亮面与阴影的关系",
      body:
        constraint === "subject"
          ? "保持人物位置，观察示例中较亮的一侧；从不同角度取景，比较面部和背景的明暗关系。"
          : constraint === "camera"
            ? "保持机位，请人物尝试稍微转向示例中较亮的一侧，比较面部亮面和阴影的变化。"
            : "在示例中请人物稍微转向较亮的一侧，观察面部亮面和阴影是否更符合想表达的感觉。",
      reason: "明暗层次可以引导视线；是否保留阴影细节取决于表达目标。",
      tradeoff:
        "转向或取景变化可能影响表情、轮廓和环境信息；亮度更高不自动代表更好。",
    };
  }
  return {
    id: `check-${goal}`,
    title:
      goal === "environment"
        ? "检查背景留下了什么"
        : goal === "creative"
          ? "留一张不同表达的版本"
          : "重拍前检查画面边缘",
    body:
      goal === "environment"
        ? "在示例里选一个真正有用的环境元素，检查它是否清楚可辨。保留人物与地点的联系，同时留意边缘的零碎形状。"
        : goal === "creative"
          ? "在允许调整的取景范围内尝试一种更紧或更松的构图，并保留当前版本。比较两个版本各自表达了什么，再选择喜欢的一张。"
          : "沿着示例画面的四边看一圈，检查人物是否被不自然地截断，以及有没有抢眼的亮块。只在确有需要时微调取景。",
    reason: `把下一张的检查点落在“${goalLabel(goal)}”，不要仅凭新旧顺序认定哪张更好。`,
    tradeoff: "重新取景可能舍弃原有信息，也可能无法解决所有背景问题。",
  };
}

/** No image parameter is accepted: this function can only return predefined demo advice. */
export function getDemoGuidance(options: DemoGuidanceOptions): DemoGuidance {
  const actions = [primaryAction(options), styleAction(options)];
  const exploring = options.depth === "explore";
  const styleTitle = STYLE_CARDS.find(
    (card) => card.id === options.style,
  )?.title;
  return {
    title: `示例方案 · ${exploring ? (options.strategy === "context" ? "环境参与表达" : "人物成为重点") : goalLabel(options.goal)}${styleTitle ? ` · ${styleTitle}` : ""}`,
    actions,
    deviceNote:
      options.device === "phone"
        ? "手机建议以机位、取景和光线为主；仅在设备确实支持时尝试人像模式。此示例没有读取你的设备能力或拍摄参数。"
        : options.device === "camera"
          ? "相机建议先确认可用镜头与拍摄参数；缺少实际 EXIF 和现场光线，示例不提供保证效果的快门或光圈数值。"
          : "器材尚不确定，当前提供设备无关的操作方向。示例没有识别你的设备或读取实际照片参数。",
    goalLabel: goalLabel(options.goal),
  };
}
