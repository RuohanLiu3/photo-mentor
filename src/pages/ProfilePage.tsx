import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import {
  ArrowRight,
  Bookmark,
  Camera,
  Check,
  History,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { GEAR_KITS } from "../gear";
import {
  createProfile,
  parseProfile,
  reconcileProfileDraft,
  type Profile,
} from "../framework";
import { LESSONS } from "../domain";
import {
  isSafeLocalText,
  preferenceLabel,
  type CompareRecord,
  type SavedState,
} from "../storage";

export default function ProfilePage({
  profile,
  setProfile,
  saved,
  onToggleFavorite,
  onToggleOwned,
  onSimulate,
  onCoach,
  onResume,
  onReplay,
  onClear,
}: {
  profile: Profile;
  setProfile: Dispatch<SetStateAction<Profile>>;
  saved: SavedState;
  onToggleFavorite: (id: string) => void;
  onToggleOwned: (id: string) => void;
  onSimulate: (id?: string) => void;
  onCoach: () => void;
  onResume: () => void;
  onReplay: (record: CompareRecord) => void;
  onClear: () => boolean;
}) {
  const [draft, setDraft] = useState(profile);
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    setDraft((current) => reconcileProfileDraft(current, profile.owned));
  }, [profile.owned]);
  const attempts = Object.values(saved.lessons).reduce(
    (n, r) => n + (r?.attempts ?? 0),
    0,
  );
  function saveProfile() {
    if (
      !isSafeLocalText(draft.cameraBody, 100, true) ||
      !isSafeLocalText(draft.lens, 100, true)
    ) {
      setNotice("器材名称请填写普通文字，不包含网址或控制字符。");
      return;
    }
    setProfile((p) =>
      parseProfile(
        JSON.stringify({
          ...p,
          device: draft.device,
          cameraBody: draft.cameraBody.trim(),
          lens: draft.lens.trim(),
          defaultGearId: p.owned.includes(draft.defaultGearId ?? "")
            ? draft.defaultGearId
            : null,
        }),
      ),
    );
    setDraft((current) => ({
      ...current,
      cameraBody: current.cameraBody.trim(),
      lens: current.lens.trim(),
    }));
    setNotice("常用设置已更新。正在进行的体验保持原设置，可主动带入。");
  }
  return (
    <div className="page frame-profile">
      <div className="page-intro">
        <h1>我的</h1>
        <p>管理器材、收藏和记录。数据仅保存在当前浏览器。</p>
      </div>
      <div className="frame-profile-stats">
        <div>
          <strong>{attempts}</strong>
          <span>练习提交</span>
        </div>
        <div>
          <strong>{saved.comparisons.length}</strong>
          <span>对比判断</span>
        </div>
        <div>
          <strong>{profile.favorites.length}</strong>
          <span>收藏套装</span>
        </div>
      </div>
      <div className="frame-actions frame-resume">
        <button className="button primary" onClick={onResume}>
          <History size={17} />
          继续拍摄体验
        </button>
        <a className="button secondary" href="#/simulator">
          <SlidersHorizontal size={17} />
          继续模拟练习
        </a>
      </div>
      <section className="frame-panel">
        <div className="frame-section-title">
          <div>
            <h2>常用拍摄设置</h2>
          </div>
          <span className="pill">本机档案</span>
        </div>
        <div className="frame-form-grid">
          <label>
            常用拍摄方式
            <select
              value={draft.device}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  device: e.target.value as Profile["device"],
                }))
              }
            >
              <option value="phone">用手机拍摄</option>
              <option value="camera">手机观察，用相机拍摄</option>
            </select>
          </label>
          <label>
            常用演示套装
            <select
              value={draft.defaultGearId ?? ""}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  defaultGearId: e.target.value || null,
                }))
              }
            >
              <option value="">不指定套装</option>
              {GEAR_KITS.filter((k) => profile.owned.includes(k.id)).map(
                (k) => (
                  <option value={k.id} key={k.id}>
                    {k.name}
                  </option>
                ),
              )}
            </select>
          </label>
          <label>
            我的相机型号（可不填）
            <input
              maxLength={100}
              value={draft.cameraBody}
              placeholder="填写你自己的机身"
              onChange={(e) =>
                setDraft((p) => ({ ...p, cameraBody: e.target.value }))
              }
            />
          </label>
          <label>
            我的镜头（可不填）
            <input
              maxLength={100}
              value={draft.lens}
              placeholder="填写镜头或常用焦段"
              onChange={(e) =>
                setDraft((p) => ({ ...p, lens: e.target.value }))
              }
            />
          </label>
        </div>
        <p className="fine-print">
          自填器材仅作为你的档案，不代表该型号已有精确模拟。套装均为教学演示配置。
        </p>
        <div className="frame-actions">
          <button className="button primary" onClick={saveProfile}>
            <Check size={16} />
            保存常用设置
          </button>
          <button className="button secondary" onClick={onCoach}>
            使用已保存设置拍摄 <ArrowRight size={16} />
          </button>
        </div>
        {notice && (
          <p role="status" className="frame-notice">
            {notice}
          </p>
        )}
      </section>
      <section className="frame-section">
        <div className="frame-section-title">
          <div>
            <h2>我的器材与收藏</h2>
          </div>
          <a href="#/gear">
            查看器材推荐 <ArrowRight size={15} />
          </a>
        </div>
        <div className="frame-kit-columns">
          {(["owned", "favorites"] as const).map((type) => (
            <div className="frame-panel" key={type}>
              <h3>
                {type === "owned" ? (
                  <Camera size={18} />
                ) : (
                  <Bookmark size={18} />
                )}{" "}
                {type === "owned" ? "已加入的器材" : "收藏"}
              </h3>
              {!profile[type].length ? (
                <p className="frame-empty">
                  {type === "owned"
                    ? "还没有加入套装。可以在上方填写自己的设备，也可以到器材页体验。"
                    : "喜欢的组合可以先收藏，收藏不会被记为已经拥有。"}
                </p>
              ) : (
                GEAR_KITS.filter((k) => profile[type].includes(k.id)).map(
                  (k) => (
                    <article className="frame-kit-row" key={k.id}>
                      <strong>{k.name}</strong>
                      <small>
                        演示配置 · {k.body} + {k.lens}
                      </small>
                      <div>
                        <button onClick={() => onSimulate(k.id)}>
                          去模拟 <ArrowRight size={14} />
                        </button>
                        <button
                          onClick={() =>
                            type === "owned"
                              ? onToggleOwned(k.id)
                              : onToggleFavorite(k.id)
                          }
                          aria-label={`${type === "owned" ? "移出我的器材" : "取消收藏"} ${k.name}`}
                        >
                          移除
                        </button>
                      </div>
                    </article>
                  ),
                )
              )}
            </div>
          ))}
        </div>
      </section>
      <section className="frame-section">
        <h2>练习记录</h2>
        <div className="frame-practice-list">
          {LESSONS.map((l) => (
            <a key={l.id} href={`#/lesson/${l.id}`}>
              <span>{l.number}</span>
              <div>
                <strong>{l.title}</strong>
                <small>
                  {saved.lessons[l.id]
                    ? `已提交 ${saved.lessons[l.id]!.attempts} 次 · ${saved.lessons[l.id]!.passed ? "曾达成本题目标" : "继续尝试中"} · ${saved.lessons[l.id]!.usedHint ? "曾使用提示" : "未使用提示"}`
                    : "还没有提交记录"}
                </small>
              </div>
              <ArrowRight size={17} />
            </a>
          ))}
        </div>
        <p className="fine-print">
          完成、达标与独立掌握是不同状态，记录只描述你实际提交过的练习。
        </p>
      </section>
      <section className="frame-section">
        <div className="frame-section-title">
          <div>
            <h2>照片对比记录</h2>
          </div>
          <small>最近 20 条</small>
        </div>
        {!saved.comparisons.length ? (
          <div className="frame-empty frame-panel">
            <History size={28} />
            <p>还没有对比记录。完成一次示例体验后，可在这里查看。</p>
            <a className="button secondary" href="#/coach">
              开始体验
            </a>
          </div>
        ) : (
          <div className="frame-records">
            {saved.comparisons.map((r) => (
              <details key={r.id} className="frame-panel">
                <summary>
                  <span>
                    <strong>{preferenceLabel(r.preference)}</strong>
                    <small>
                      {r.goal} ·{" "}
                      {r.source === "demo" ? "内置示例" : "个人图片 · 手动比较"}
                    </small>
                  </span>
                  <span>
                    {new Date(r.createdAt).toLocaleDateString("zh-CN")}
                  </span>
                </summary>
                <div className="frame-record-detail">
                  <p>{r.reason || "这次没有填写原因。"}</p>
                  <small>
                    保存于 {new Date(r.createdAt).toLocaleString("zh-CN")}
                    。这是你的偏好，不能据此判断已掌握。
                  </small>
                  {r.source === "demo" && r.scenarioId && (
                    <button
                      className="button secondary"
                      onClick={() => onReplay(r)}
                    >
                      再次体验同一示例 <ArrowRight size={15} />
                    </button>
                  )}
                  {r.source === "personal" && (
                    <p className="fine-print">
                      原照片未长期保存。继续比较时可重新选择文件。
                    </p>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
      <section className="frame-data">
        <div>
          <strong>本机数据</strong>
          <p>
            没有账号或云同步。清除后会删除本网站在此浏览器的练习、示例进度、档案和收藏。
          </p>
        </div>
        {confirm ? (
          <div className="frame-actions">
            <span>确认清除全部本机数据？</span>
            <button
              className="button secondary"
              onClick={() => {
                const cleared = onClear();
                setDraft(createProfile());
                setConfirm(false);
                setNotice(
                  cleared
                    ? "本网站的本机记录已清除。"
                    : "当前页面已清空，但浏览器未能删除部分已保存数据。请在浏览器设置中清除本网站数据。",
                );
              }}
            >
              确认清除
            </button>
            <button className="button ghost" onClick={() => setConfirm(false)}>
              取消
            </button>
          </div>
        ) : (
          <button className="button ghost" onClick={() => setConfirm(true)}>
            <Trash2 size={16} />
            清除本机数据
          </button>
        )}
      </section>
    </div>
  );
}
