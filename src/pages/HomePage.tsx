import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Layers,
  SlidersHorizontal,
} from "lucide-react";
import Scene from "../components/Scene";

const shortcuts = [
  {
    href: "#/simulator",
    icon: SlidersHorizontal,
    title: "相机模拟",
    detail: "动手调节快门、光圈与 ISO",
  },
  {
    href: "#/learn",
    icon: BookOpen,
    title: "摄影练习",
    detail: "从构图、景深和曝光开始",
  },
  {
    href: "#/gear",
    icon: Layers,
    title: "器材推荐",
    detail: "按拍摄用途，比较器材方案",
  },
];

export default function HomePage({
  onStart,
  canContinue,
  onContinue,
  recordCount,
}: {
  onStart: () => void;
  canContinue: boolean;
  onContinue: () => void;
  recordCount: number;
}) {
  const [example, setExample] = useState<"before" | "after">("before");
  return (
    <div className="page frame-home">
      <section className="home-start" aria-labelledby="home-title">
        <div className="home-start-copy">
          <h1 id="home-title">拍好下一张。</h1>
          <p>从构图到用光，一次练习一个调整。</p>
          <div className="home-start-actions">
            <button
              className="button primary"
              onClick={canContinue ? onContinue : onStart}
            >
              {canContinue ? "继续拍摄" : "开始拍摄"}{" "}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
            {canContinue && (
              <button className="home-new-session" onClick={onStart}>
                开始新的练习
              </button>
            )}
          </div>
          <span className="home-demo-note">
            示例体验 · 手机取景与 AI 分析尚未开放
          </span>
        </div>
        <figure className="home-example">
          <div className="home-example-image">
            <Scene mode="composition" variant={example} />
            <span className="home-example-label">构图示例</span>
          </div>
          <figcaption>
            <p aria-live="polite">
              {example === "before"
                ? "留意人物背后的立柱。"
                : "换个位置，让人物与背景分开。"}
            </p>
            <div
              className="home-example-switch"
              role="group"
              aria-label="构图示例前后对比"
            >
              <button
                aria-pressed={example === "before"}
                onClick={() => setExample("before")}
              >
                调整前
              </button>
              <button
                aria-pressed={example === "after"}
                onClick={() => setExample("after")}
              >
                调整后
              </button>
            </div>
          </figcaption>
        </figure>
      </section>
      <section className="home-explore" aria-labelledby="home-explore-title">
        <h2 id="home-explore-title">继续探索</h2>
        <div className="home-shortcuts">
          {shortcuts.map(({ href, icon: Icon, title, detail }) => (
            <a key={href} href={href}>
              <span className="home-shortcut-icon">
                <Icon size={22} strokeWidth={1.6} aria-hidden="true" />
              </span>
              <div>
                <h3>{title}</h3>
                <p>{detail}</p>
              </div>
              <ChevronRight size={18} aria-hidden="true" />
            </a>
          ))}
        </div>
      </section>
      {recordCount > 0 && (
        <a className="home-records" href="#/journal">
          <span>
            我的记录 <small>{recordCount} 次对比</small>
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </a>
      )}
    </div>
  );
}
