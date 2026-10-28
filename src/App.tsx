import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Camera,
  Focus,
  Home,
  Layers,
  UserRound,
  X,
  ArrowRight,
} from "lucide-react";
import { Learn, Lesson, Styles } from "./pages/LearningPages";
import HomePage from "./pages/HomePage";
import ProfilePage from "./pages/ProfilePage";
import PersonalComparePage, {
  type LocalPhoto,
} from "./pages/PersonalComparePage";
import GearPage from "./pages/GearPage";
import SimulatorPage from "./pages/SimulatorPage";
import CoachPage from "./pages/CoachPage";
import { GEAR_KITS, createGearState, parseGearState } from "./gear";
import { createSimulatorState, parseSimulatorState } from "./simulator";
import {
  SCENARIOS,
  createCoachSession,
  parseCoachSession,
  patchCoachContext,
  selectCoachScenario,
} from "./coaching";
import { type Goal, type LessonId, type StyleId } from "./domain";
import {
  STORAGE_KEY,
  parseSavedState,
  recordComparison,
  recordLesson,
  normalizeComparisonRecord,
  type CompareRecord,
} from "./storage";
import {
  COACH_KEY,
  GEAR_KEY,
  PROFILE_KEY,
  SIMULATOR_KEY,
  NAV_ITEMS,
  activeNav,
  createProfile,
  go,
  parseProfile,
  routeFromHash,
  toggleProfileKit,
  profileEquipmentContext,
  clearLocalData,
  startSimulatorLesson,
} from "./framework";
import { useLocalState } from "./hooks/useLocalState";
import "./framework.css";
import "./home.css";

export default function App() {
  const [page, setPage] = useState(() => routeFromHash(window.location.hash));
  const [saved, setSaved, historyError] = useLocalState(
    STORAGE_KEY,
    parseSavedState,
  );
  const [profile, setProfile, profileError] = useLocalState(
    PROFILE_KEY,
    parseProfile,
  );
  const [gear, setGear, gearError] = useLocalState(GEAR_KEY, parseGearState);
  const [simulator, setSimulator, simulatorError] = useLocalState(
    SIMULATOR_KEY,
    parseSimulatorState,
  );
  const [session, setSession, coachError] = useLocalState(
    COACH_KEY,
    parseCoachSession,
  );
  const [first, setFirst] = useState<LocalPhoto | null>(null);
  const [second, setSecond] = useState<LocalPhoto | null>(null);
  const [about, setAbout] = useState(false);
  const [bridge, setBridge] = useState("");
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    const handler = () => {
      setPage(routeFromHash(window.location.hash));
      window.scrollTo({ top: 0, behavior: "instant" });
      main.current?.focus({ preventScroll: true });
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  useEffect(
    () => () => {
      if (first) URL.revokeObjectURL(first.url);
    },
    [first],
  );
  useEffect(
    () => () => {
      if (second) URL.revokeObjectURL(second.url);
    },
    [second],
  );
  useEffect(() => {
    if (page === "/simulator" && profile.defaultGearId)
      setSimulator((current) =>
        current.gearId
          ? current
          : { ...current, gearId: profile.defaultGearId },
      );
  }, [page, profile.defaultGearId, setSimulator]);
  const active = activeNav(page);
  const icons = [Home, Camera, BookOpen, Layers, UserRound];
  const storageError =
    historyError || profileError || gearError || simulatorError || coachError;
  function profileContext() {
    return profileEquipmentContext(profile);
  }
  function start() {
    setSession(createCoachSession(profileContext()));
    setBridge("");
    go("/coach");
  }
  function enterCoach(style?: StyleId, lesson?: LessonId, goal?: Goal) {
    setSession((s) => {
      let next = patchCoachContext(s, {
        ...(style ? { style } : {}),
        ...(goal ? { goal } : {}),
      });
      if (goal === "environment")
        next = selectCoachScenario(next, "environment");
      if (style === "light") next = selectCoachScenario(next, "light");
      return next;
    });
    if (lesson)
      setBridge(
        lesson === "motion"
          ? "已从曝光练习进入。这里先体验机位、构图与用光示例。"
          : "已带入本次练习的表达目标，你仍然可以修改。",
      );
    go("/coach");
  }
  function openSimulator(gearId?: string) {
    if (gearId && GEAR_KITS.some((k) => k.id === gearId))
      setSimulator((s) => ({ ...s, gearId }));
    go("/simulator");
  }
  function coachWithGear(id: string) {
    const kit = GEAR_KITS.find((k) => k.id === id);
    if (!kit) return;
    setSession((s) =>
      patchCoachContext(s, {
        device: "camera",
        gearId: kit.id,
        cameraBody: kit.body,
        lens: kit.lens,
      }),
    );
    setBridge("本次体验已带入演示套装；常用档案保持不变。");
    go("/coach");
  }
  function simulatorToCoach(goal?: Goal, gearId?: string) {
    if (gearId) coachWithGear(gearId);
    enterCoach(undefined, undefined, goal);
  }
  function saveRecord(r: CompareRecord): boolean {
    const record = normalizeComparisonRecord(r);
    if (!record) return false;
    setSaved((s) => recordComparison(s, record));
    return true;
  }
  function practice(id: LessonId, passed: boolean, hint: boolean) {
    setSaved((s) =>
      recordLesson(s, id, passed, hint, new Date().toISOString()),
    );
  }
  function replay(record: CompareRecord) {
    const scenario = SCENARIOS.find((s) => s.id === record.scenarioId);
    if (!scenario) return;
    setSession(
      selectCoachScenario(
        createCoachSession({ ...profileContext(), goal: scenario.goal }),
        scenario.id,
      ),
    );
    setBridge("已开始同一示例的新体验。原来的判断仍保留在记录中。");
    go("/coach");
  }
  function clearAll(): boolean {
    let cleared = false;
    try {
      cleared = clearLocalData(localStorage).cleared;
    } catch {
      /* Some browsers also deny access to the localStorage property. */
    }
    setSaved(parseSavedState(null));
    setProfile(createProfile());
    setGear(createGearState());
    setSimulator(createSimulatorState());
    setSession(createCoachSession());
    setFirst(null);
    setSecond(null);
    setBridge("");
    return cleared;
  }
  const nav = (mobile = false) => (
    <nav
      className={mobile ? "frame-mobile-nav" : "frame-desktop-nav"}
      aria-label={mobile ? "手机主导航" : "主导航"}
    >
      {NAV_ITEMS.map((item, i) => {
        const Icon = icons[i];
        return (
          <a
            key={item.path}
            href={`#${item.path}`}
            aria-current={active === item.path ? "page" : undefined}
          >
            <Icon size={mobile ? 22 : 16} aria-hidden="true" />
            <span>{item.label}</span>
          </a>
        );
      })}
    </nav>
  );
  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          main.current?.focus();
        }}
      >
        跳到正文
      </a>
      <header className="frame-header">
        <a className="frame-brand" href="#/" aria-label="取景 FRAME 首页">
          <Focus size={27} />
          <strong>
            取景 <span>FRAME</span>
          </strong>
        </a>
        {nav()}
        <button
          className="frame-version"
          aria-label="关于取景体验版"
          aria-expanded={about}
          onClick={() => setAbout(!about)}
        >
          体验版
        </button>
      </header>
      <main id="main" ref={main} tabIndex={-1}>
        {storageError && (
          <div className="storage-warning" role="status">
            当前浏览器未能保存部分数据。你可以继续体验，刷新或关闭后可能无法恢复这次进度。
          </div>
        )}
        {page === "/" && (
          <HomePage
            onStart={start}
            canContinue={
              session.phase !== "setup" || session.contextVersion > 1
            }
            onContinue={() => go("/coach")}
            recordCount={saved.comparisons.length}
          />
        )}
        {page === "/coach" && (
          <>
            {bridge && (
              <div className="frame-bridge" role="status">
                <span>{bridge}</span>
                <button onClick={() => setBridge("")} aria-label="关闭目标提示">
                  <X size={16} />
                </button>
              </div>
            )}
            <CoachPage
              session={session}
              setSession={setSession}
              onSave={saveRecord}
              onStyles={() => go("/styles")}
              onPersonal={() => go("/photos")}
            />
          </>
        )}
        {page === "/learn" && (
          <>
            <Learn saved={saved} />
            <div className="page frame-learning-links">
              <a href="#/simulator">
                <Camera size={22} />
                <div>
                  <strong>相机模拟</strong>
                  <small>认识按键，动手调节参数</small>
                </div>
                <ArrowRight size={18} />
              </a>
              <a href="#/styles">
                <Focus size={22} />
                <div>
                  <strong>拍摄方法</strong>
                  <small>构图、环境与光线</small>
                </div>
                <ArrowRight size={18} />
              </a>
            </div>
          </>
        )}
        {page.startsWith("/lesson/") && (
          <>
            <Lesson
              key={page}
              id={page.split("/")[2] as LessonId}
              onSubmit={practice}
              enterCoach={enterCoach}
            />
            <div className="page frame-lesson-simulator">
              <button
                className="button secondary"
                onClick={() => {
                  setSimulator((s) =>
                    startSimulatorLesson(s, page.split("/")[2] as LessonId),
                  );
                  go("/simulator");
                }}
              >
                在机型模拟器中继续练习 <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}
        {page === "/styles" && (
          <>
            <div className="page frame-return">
              <a className="back-link" href="#/coach">
                ← 返回拍摄，保留原进度
              </a>
            </div>
            <Styles enterCoach={enterCoach} />
          </>
        )}
        {page === "/gear" && (
          <GearPage
            state={gear}
            setState={setGear}
            favorites={profile.favorites}
            owned={profile.owned}
            onToggleFavorite={(id) =>
              setProfile((p) => toggleProfileKit(p, "favorites", id))
            }
            onToggleOwned={(id) =>
              setProfile((p) => toggleProfileKit(p, "owned", id))
            }
            onSimulate={openSimulator}
            onCoach={coachWithGear}
          />
        )}
        {page === "/simulator" && (
          <SimulatorPage
            state={simulator}
            setState={setSimulator}
            gearName={GEAR_KITS.find((k) => k.id === simulator.gearId)?.name}
            onCoach={simulatorToCoach}
            onPractice={practice}
          />
        )}
        {page === "/journal" && (
          <ProfilePage
            profile={profile}
            setProfile={setProfile}
            saved={saved}
            onToggleFavorite={(id) =>
              setProfile((p) => toggleProfileKit(p, "favorites", id))
            }
            onToggleOwned={(id) =>
              setProfile((p) => toggleProfileKit(p, "owned", id))
            }
            onSimulate={openSimulator}
            onCoach={() => {
              setSession((s) => patchCoachContext(s, profileContext()));
              setBridge("已将常用档案带入本次体验。");
              go("/coach");
            }}
            onResume={() => go("/coach")}
            onReplay={replay}
            onClear={clearAll}
          />
        )}
        {page === "/photos" && (
          <PersonalComparePage
            first={first}
            second={second}
            setFirst={setFirst}
            setSecond={setSecond}
            onSave={saveRecord}
          />
        )}
      </main>
      <footer className="frame-footer">
        <span>
          <Focus size={15} />
          取景 FRAME
        </span>
        <small>教学示例 · 本机保存</small>
      </footer>
      {nav(true)}
      {about && (
        <aside className="frame-about" aria-label="产品体验版说明">
          <button aria-label="关闭说明" onClick={() => setAbout(false)}>
            <X size={18} />
          </button>
          <strong>关于取景 · 体验版 0.4</strong>
          <p>
            指导与器材结果采用内置教学示例，模拟器使用通用教学配置。未调用摄像头或
            AI，没有账号与云同步。你的记录只保存在当前浏览器。
          </p>
          <a href="#/journal" onClick={() => setAbout(false)}>
            管理本机记录 <ArrowRight size={15} />
          </a>
        </aside>
      )}
    </>
  );
}
