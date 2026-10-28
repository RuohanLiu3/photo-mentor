import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction, ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Aperture,
  Backpack,
  Camera,
  Check,
  ChevronRight,
  Heart,
  Plus,
  Scale,
  SlidersHorizontal,
  Video,
  X,
} from "lucide-react";
import {
  GEAR_KITS,
  GEAR_PORTABILITY_LABELS,
  GEAR_SUBJECT_LABELS,
  formatGearMoney,
  gearTotal,
  getGearKit,
  rankGearKits,
  toggleComparison,
} from "../gear";
import type { GearKit, GearMatch, GearQuestionnaire, GearState } from "../gear";
import "../gear.css";

export interface GearPageProps {
  state: GearState;
  setState: Dispatch<SetStateAction<GearState>>;
  favorites: string[];
  owned: string[];
  onToggleFavorite: (id: string) => void;
  onToggleOwned: (id: string) => void;
  onSimulate: (id: string) => void;
  onCoach: (id: string) => void;
}

function Choices<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="gear-field">
      <legend>{label}</legend>
      <div className="gear-choices">
        {options.map(([id, text]) => (
          <label
            key={id}
            className={`gear-choice ${value === id ? "is-selected" : ""}`}
          >
            <input
              type="radio"
              name={label}
              value={id}
              checked={value === id}
              onChange={() => onChange(id)}
            />
            <span>{text}</span>
            {value === id && <Check size={14} aria-hidden="true" />}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function KitIllustration({
  kit,
  large = false,
}: {
  kit: GearKit;
  large?: boolean;
}) {
  const Icon =
    kit.icon === "video"
      ? Video
      : kit.icon === "travel"
        ? Backpack
        : kit.icon === "portrait"
          ? Aperture
          : Camera;
  return (
    <div
      className={`gear-visual gear-tone-${kit.accent} ${large ? "gear-visual-large" : ""}`}
      aria-hidden="true"
    >
      <span className="gear-visual-word">FRAME / STUDY</span>
      <div className="gear-camera-art">
        <div className="gear-camera-top" />
        <div className="gear-camera-dot" />
        <div className="gear-camera-lens">
          <Aperture size={large ? 68 : 48} strokeWidth={1} />
        </div>
        <span>F</span>
      </div>
      <div className="gear-visual-tag">
        <Icon size={15} />
        <span>
          {kit.icon === "video"
            ? "PHOTO + VIDEO"
            : kit.icon === "travel"
              ? "GO EXPLORE"
              : kit.icon === "portrait"
                ? "PEOPLE FIRST"
                : "EVERYDAY"}
        </span>
      </div>
    </div>
  );
}

export default function GearPage({
  state,
  setState,
  favorites,
  owned,
  onToggleFavorite,
  onToggleOwned,
  onSimulate,
  onCoach,
}: GearPageProps) {
  const [notice, setNotice] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    heading.current?.focus({ preventScroll: true });
  }, [state.step, state.detailId]);
  const q = state.questionnaire;
  const matches = rankGearKits(q);
  const detail = getGearKit(state.detailId);
  const compared = state.comparedIds
    .map(getGearKit)
    .filter((kit): kit is GearKit => !!kit);
  const go = (step: GearState["step"]) => {
    setNotice("");
    setState((current) => ({ ...current, step }));
  };
  const update = <K extends keyof GearQuestionnaire>(
    key: K,
    value: GearQuestionnaire[K],
  ) =>
    setState((current) => ({
      ...current,
      questionnaire: { ...current.questionnaire, [key]: value },
    }));
  const openDetail = (id: string) => {
    setNotice("");
    setState((current) => ({ ...current, detailId: id, step: "detail" }));
  };
  const compare = (id: string) => {
    if (!state.comparedIds.includes(id) && state.comparedIds.length >= 3) {
      setNotice("最多对比三套，请先移除一套。");
      return;
    }
    setNotice("");
    setState((current) => ({
      ...current,
      comparedIds: toggleComparison(current.comparedIds, id),
    }));
  };
  const favoriteButton = (kit: GearKit, full = false) => (
    <button
      type="button"
      className={full ? "button secondary gear-action" : "gear-icon-button"}
      aria-label={`${favorites.includes(kit.id) ? "取消收藏" : "收藏"}${kit.name}`}
      aria-pressed={favorites.includes(kit.id)}
      onClick={() => onToggleFavorite(kit.id)}
    >
      <Heart
        size={18}
        fill={favorites.includes(kit.id) ? "currentColor" : "none"}
      />
      {full && (favorites.includes(kit.id) ? "已收藏" : "收藏这套")}
    </button>
  );
  const money = (kit: GearKit) =>
    formatGearMoney(gearTotal(kit, q.currency), q.currency);
  const actionButtons = (kit: GearKit) => (
    <div className="gear-detail-actions">
      <button className="button primary" onClick={() => onSimulate(kit.id)}>
        <SlidersHorizontal size={17} />
        进入模拟练习
      </button>
      <button className="button secondary" onClick={() => onCoach(kit.id)}>
        带入拍摄准备
        <ArrowRight size={17} />
      </button>
      <button
        className="button secondary"
        aria-pressed={owned.includes(kit.id)}
        onClick={() => onToggleOwned(kit.id)}
      >
        {owned.includes(kit.id) ? <Check size={17} /> : <Plus size={17} />}
        {owned.includes(kit.id) ? "已加入我的器材" : "加入我的器材"}
      </button>
      {favoriteButton(kit, true)}
    </div>
  );
  const compareBar = compared.length > 0 && state.step !== "compare" && (
    <aside className="gear-compare-dock" aria-label="待对比的器材">
      <div>
        <strong>已选 {compared.length} / 3 套</strong>
        <span>{compared.map((kit) => kit.name).join(" · ")}</span>
      </div>
      <button className="button primary" onClick={() => go("compare")}>
        <Scale size={17} />
        查看对比
      </button>
    </aside>
  );

  return (
    <div className="page gear-page">
      <header className="gear-heading">
        <div>
          <h1 ref={heading} tabIndex={-1}>
            器材推荐
          </h1>
          <p>填写拍摄需求，比较机身与镜头组合。</p>
        </div>
        <span className="pill gear-demo-badge">教学器材 · 示例体验</span>
      </header>
      <div className="gear-progress" aria-label="器材探索流程">
        <span className={state.step === "questionnaire" ? "is-current" : ""}>
          <b>01</b> 了解需求
        </span>
        <ChevronRight size={15} />
        <span className={state.step !== "questionnaire" ? "is-current" : ""}>
          <b>02</b> 比较组合
        </span>
        <ChevronRight size={15} />
        <span>
          <b>03</b> 上手练习
        </span>
      </div>
      {state.step === "questionnaire" ? (
        <div className="gear-questionnaire-layout">
          <aside className="gear-intro-card">
            <h2>预算、镜头与便携性</h2>
            <KitIllustration kit={GEAR_KITS[0]} large />
            <p>
              这里用四套虚构教学组合，帮助你理解预算、镜头和携带之间的取舍。
            </p>
            <div className="gear-intro-note">
              <Aperture size={20} />
              <span>
                不用先懂品牌与参数。
                <br />
                从你最常拍的场景开始。
              </span>
            </div>
          </aside>
          <form
            className="gear-form"
            onSubmit={(event) => {
              event.preventDefault();
              go("results");
            }}
          >
            <div className="gear-form-heading">
              <span className="gear-section-number">01</span>
              <div>
                <h2>你的拍摄需求</h2>
                <p>可以随时回来修改，不需要注册。</p>
              </div>
            </div>
            <fieldset className="gear-field">
              <legend>这次为机身＋镜头预留多少预算？</legend>
              <div className="gear-budget-input">
                <label>
                  <span className="gear-visually-hidden">预算币种</span>
                  <select
                    aria-label="预算币种"
                    value={q.currency}
                    onChange={(event) =>
                      update(
                        "currency",
                        event.target.value as GearQuestionnaire["currency"],
                      )
                    }
                  >
                    <option value="USD">USD 美元</option>
                    <option value="CNY">CNY 人民币</option>
                  </select>
                </label>
                <label className="gear-budget-number">
                  <span className="gear-visually-hidden">预算上限</span>
                  <input
                    aria-label="预算上限"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="1000000"
                    step="0.01"
                    placeholder="留空表示暂不限预算"
                    value={q.budget}
                    onChange={(event) =>
                      update("budget", event.target.value.slice(0, 12))
                    }
                  />
                </label>
              </div>
              <p className="gear-field-hint">
                留空可查看全部。币种切换不换算已输入金额；套装金额仅用于演示预算分配。
              </p>
            </fieldset>
            <Choices
              label="最常想拍什么？"
              value={q.subject}
              options={[
                ["everyday", "日常记录"],
                ["portrait", "人像互拍"],
                ["travel", "旅行与风景"],
                ["action", "运动与抓拍"],
              ]}
              onChange={(value) => update("subject", value)}
            />
            <Choices
              label="你希望怎么带出门？"
              value={q.portable}
              options={[
                ["light", "越轻越好"],
                ["balanced", "便携与功能平衡"],
                ["flexible", "可以多带一些"],
              ]}
              onChange={(value) => update("portable", value)}
            />
            <Choices
              label="你的拍摄经验"
              value={q.experience}
              options={[
                ["first", "从基础开始"],
                ["improving", "已有一些经验"],
              ]}
              onChange={(value) => update("experience", value)}
            />
            <Choices
              label="视频对你有多重要？"
              value={q.video}
              options={[
                ["occasionally", "偶尔记录"],
                ["regularly", "经常拍视频"],
                ["priority", "和照片一样重要"],
              ]}
              onChange={(value) => update("video", value)}
            />
            <label
              className="gear-field gear-text-field"
              htmlFor="gear-existing"
            >
              <span>
                已经在用什么？ <small>可选</small>
              </span>
              <input
                id="gear-existing"
                maxLength={160}
                value={q.existing}
                onChange={(event) => update("existing", event.target.value)}
                placeholder="例如：一台手机，或已有机身与镜头"
              />
              <span className="gear-field-hint">
                已有器材只作为你的记录，本轮示例不判断真实卡口兼容。
              </span>
            </label>
            <button className="button primary gear-submit" type="submit">
              看看适合的组合
              <ArrowRight size={18} />
            </button>
          </form>
        </div>
      ) : (
        <>
          <div className="gear-toolbar">
            <button
              className="gear-text-button"
              onClick={() =>
                go(state.step === "results" ? "questionnaire" : "results")
              }
            >
              <ArrowLeft size={17} />
              {state.step === "results" ? "修改需求" : "返回推荐组合"}
            </button>
            <button className="gear-text-button" onClick={() => go("compare")}>
              <Scale size={17} />
              对比组合 {compared.length > 0 && `(${compared.length})`}
            </button>
          </div>
          {state.step === "results" && (
            <>
              <div className="gear-results-heading">
                <div>
                  <h2>匹配的教学组合</h2>
                  <p>
                    {GEAR_SUBJECT_LABELS[q.subject]} ·{" "}
                    {GEAR_PORTABILITY_LABELS[q.portable]} ·{" "}
                    {q.budget.trim()
                      ? `预算 ${formatGearMoney(Number(q.budget), q.currency)}`
                      : "暂不限预算"}
                  </p>
                </div>
                <span>{matches.length} 套教学组合</span>
              </div>
              <p className="gear-source-note">
                以下均为虚构教学器材。金额用于筛选演示，不是真实商品报价；排序来自本地需求匹配。
              </p>
              {matches.length === 0 ? (
                <div className="gear-empty">
                  <Backpack size={36} strokeWidth={1.3} />
                  <h3>暂无预算内的示例</h3>
                  <p>
                    这只说明当前四套演示组合的范围有限，不代表真实市场没有选择。你可以修改预算，或先了解全部组合的取舍。
                  </p>
                  <div>
                    <button
                      className="button primary"
                      onClick={() => go("questionnaire")}
                    >
                      修改需求
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => update("budget", "")}
                    >
                      暂不限预算，查看示例
                    </button>
                  </div>
                </div>
              ) : (
                <div className="gear-kit-grid">
                  {matches.map((match, index) => (
                    <KitCard
                      key={match.kit.id}
                      match={match}
                      index={index}
                      amount={money(match.kit)}
                      selected={state.comparedIds.includes(match.kit.id)}
                      onDetail={() => openDetail(match.kit.id)}
                      onCompare={() => compare(match.kit.id)}
                      favorite={favoriteButton(match.kit)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
          {state.step === "detail" && detail && (
            <div className="gear-detail">
              <div>
                <KitIllustration kit={detail} large />
                <p className="gear-caption">概念外观示意 · 不对应真实型号</p>
              </div>
              <div className="gear-detail-content">
                <h2>{detail.name}</h2>
                <p className="gear-detail-tagline">{detail.tagline}</p>
                <div className="gear-kit-parts">
                  <span>
                    <Camera size={18} />
                    {detail.body}
                  </span>
                  <span>
                    <Aperture size={18} />
                    {detail.lens}
                  </span>
                </div>
                <div className="gear-budget-breakdown">
                  <span>
                    示例预算分配 <strong>{money(detail)}</strong>
                  </span>
                  <div className="gear-budget-track">
                    <span
                      style={{
                        width: `${(detail.budget[q.currency].body / gearTotal(detail, q.currency)) * 100}%`,
                      }}
                    />
                  </div>
                  <div>
                    <span>
                      机身{" "}
                      {formatGearMoney(
                        detail.budget[q.currency].body,
                        q.currency,
                      )}
                    </span>
                    <span>
                      镜头{" "}
                      {formatGearMoney(
                        detail.budget[q.currency].lens,
                        q.currency,
                      )}
                    </span>
                  </div>
                  <small>虚构金额用于理解分配，不是真实价格或购买建议。</small>
                </div>
                <DetailList title="适合什么" items={detail.strengths} />
                <DetailList title="需要取舍" items={detail.tradeoffs} />
                <div className="gear-practice-note">
                  <SlidersHorizontal size={20} />
                  <div>
                    <strong>模拟练习</strong>
                    <p>{detail.practice}</p>
                    <small>
                      当前进入通用教学配置，演示参数与操作，不复现某一真实机型。
                    </small>
                  </div>
                </div>
                {actionButtons(detail)}
                <button
                  className="gear-text-button"
                  onClick={() => compare(detail.id)}
                >
                  <Scale size={17} />
                  {state.comparedIds.includes(detail.id)
                    ? "移出对比"
                    : "加入对比"}
                </button>
                <p className="gear-field-hint">
                  收藏与“我的器材”分别保存。只有点击“加入我的器材”才会加入本机档案；此处保存的是教学组合。
                </p>
              </div>
            </div>
          )}
          {state.step === "compare" && (
            <section className="gear-comparison">
              <div className="gear-results-heading">
                <div>
                  <h2>器材组合对比</h2>
                  <p>比较预算、用途和取舍。</p>
                </div>
                <span>{compared.length} / 3 套</span>
              </div>
              {compared.length === 0 ? (
                <div className="gear-empty">
                  <Scale size={36} strokeWidth={1.3} />
                  <h3>还没有选择对比组合</h3>
                  <p>在推荐卡片上点击“加入对比”，最多可以放入三套。</p>
                  <button
                    className="button primary"
                    onClick={() => go("results")}
                  >
                    选择组合
                    <ArrowRight size={17} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="gear-compare-selected">
                    {compared.map((kit) => (
                      <span key={kit.id}>
                        {kit.name}
                        <button
                          aria-label={`移除${kit.name}`}
                          onClick={() => compare(kit.id)}
                        >
                          <X size={16} />
                        </button>
                      </span>
                    ))}
                    {compared.length < 3 && (
                      <button
                        className="gear-text-button"
                        onClick={() => go("results")}
                      >
                        <Plus size={16} />
                        再选一套
                      </button>
                    )}
                  </div>
                  {compared.length === 1 && (
                    <p className="gear-source-note">
                      当前只有一套。再加入一套，就能比较不同取舍。
                    </p>
                  )}
                  <ComparisonGroup
                    title="机身与镜头"
                    kits={compared}
                    render={(kit) => (
                      <>
                        <strong>{kit.body}</strong>
                        <p>{kit.lens}</p>
                      </>
                    )}
                  />
                  <ComparisonGroup
                    title="示例预算分配"
                    kits={compared}
                    render={(kit) => (
                      <>
                        <strong className="gear-compare-amount">
                          {money(kit)}
                        </strong>
                        <p>
                          机身{" "}
                          {formatGearMoney(
                            kit.budget[q.currency].body,
                            q.currency,
                          )}{" "}
                          · 镜头{" "}
                          {formatGearMoney(
                            kit.budget[q.currency].lens,
                            q.currency,
                          )}
                        </p>
                      </>
                    )}
                  />
                  <ComparisonGroup
                    title="题材与携带"
                    kits={compared}
                    render={(kit) => (
                      <>
                        <strong>
                          {kit.subjects
                            .map((subject) => GEAR_SUBJECT_LABELS[subject])
                            .join(" · ")}
                        </strong>
                        <p>{GEAR_PORTABILITY_LABELS[kit.portable]}</p>
                      </>
                    )}
                  />
                  <ComparisonGroup
                    title="适合什么"
                    kits={compared}
                    render={(kit) => (
                      <ul>
                        {kit.strengths.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )}
                  />
                  <ComparisonGroup
                    title="需要取舍"
                    kits={compared}
                    render={(kit) => (
                      <ul>
                        {kit.tradeoffs.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )}
                  />
                  <ComparisonGroup
                    title="下一步"
                    kits={compared}
                    render={(kit) => (
                      <div className="gear-compare-actions">
                        <button
                          className="button primary"
                          onClick={() => onSimulate(kit.id)}
                        >
                          进入模拟
                          <ArrowRight size={16} />
                        </button>
                        <button
                          className="gear-text-button"
                          onClick={() => openDetail(kit.id)}
                        >
                          查看详情
                        </button>
                        {favoriteButton(kit, true)}
                      </div>
                    )}
                  />
                  <p className="gear-source-note">
                    全部信息为教学设定，不包含真实型号、兼容性或实时价格。模拟使用同一套通用摄影教学配置。
                  </p>
                </>
              )}
            </section>
          )}
        </>
      )}
      <p className="gear-notice" role="status">
        {notice}
      </p>
      {compareBar}
    </div>
  );
}

function KitCard({
  match,
  index,
  amount,
  selected,
  onDetail,
  onCompare,
  favorite,
}: {
  match: GearMatch;
  index: number;
  amount: string;
  selected: boolean;
  onDetail: () => void;
  onCompare: () => void;
  favorite: ReactNode;
}) {
  const { kit } = match;
  return (
    <article className="gear-kit-card">
      <div className="gear-card-visual">
        <button
          className="gear-image-button"
          aria-label={`查看${kit.name}详情`}
          onClick={onDetail}
        >
          <KitIllustration kit={kit} />
        </button>
        <span className="gear-match-badge">
          {index === 0 ? "优先了解" : "另一个方向"}
        </span>
        <div className="gear-card-favorite">{favorite}</div>
      </div>
      <div className="gear-card-content">
        <div className="gear-card-title">
          <h3>
            <button onClick={onDetail}>{kit.name}</button>
          </h3>
          <span>
            {amount}
            <small>示例分配</small>
          </span>
        </div>
        <p className="gear-card-description">
          {kit.body} ＋ {kit.lens}
        </p>
        <div className="gear-match-reasons">
          <strong>为什么放在这里</strong>
          <ul>
            {match.reasons.map((reason) => (
              <li key={reason}>
                <Check size={13} />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="gear-card-tradeoff">
          <span>取舍</span>
          {match.considerations[0] || kit.tradeoffs[0]}
        </p>
        <div className="gear-card-actions">
          <button className="gear-text-button" onClick={onDetail}>
            了解这套
            <ArrowRight size={16} />
          </button>
          <button
            className={`gear-compare-toggle ${selected ? "is-selected" : ""}`}
            aria-pressed={selected}
            onClick={onCompare}
          >
            {selected ? <Check size={15} /> : <Plus size={15} />}
            {selected ? "已选对比" : "加入对比"}
          </button>
        </div>
      </div>
    </article>
  );
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="gear-detail-list">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function ComparisonGroup({
  title,
  kits,
  render,
}: {
  title: string;
  kits: GearKit[];
  render: (kit: GearKit) => ReactNode;
}) {
  return (
    <div className="gear-compare-group">
      <h3>{title}</h3>
      <div
        className="gear-compare-cells"
        style={{ "--gear-columns": kits.length } as React.CSSProperties}
      >
        {kits.map((kit) => (
          <div className="gear-compare-cell" key={kit.id}>
            <span className="gear-compare-name">{kit.name}</span>
            {render(kit)}
          </div>
        ))}
      </div>
    </div>
  );
}
