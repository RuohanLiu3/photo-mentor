import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ImagePlus, RotateCcw, X } from "lucide-react";
import {
  isSafeLocalText,
  isValidComparisonGoal,
  preferenceLabel,
  type CompareRecord,
} from "../storage";
export type LocalPhoto = { url: string; name: string };
function Picker({
  label,
  photo,
  setPhoto,
}: {
  label: string;
  photo: LocalPhoto | null;
  setPhoto: (p: LocalPhoto | null) => void;
}) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      generation.current++;
    };
  }, []);
  return (
    <div className="frame-picker">
      <div className="frame-picker-heading">
        <strong>{label}</strong>
        {photo && (
          <button
            aria-label={`移除${label}`}
            onClick={() => {
              generation.current++;
              setPhoto(null);
              setLoading(false);
              setError("");
            }}
          >
            <X size={17} />
          </button>
        )}
      </div>
      <label className="button secondary">
        <ImagePlus size={17} />
        {loading ? "正在读取…" : photo ? "更换图片" : "选择图片"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label={`选择${label}`}
          disabled={loading}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setError("");
            const gen = ++generation.current;
            if (
              !["image/jpeg", "image/png", "image/webp"].includes(file.type)
            ) {
              setError("请选择 JPG、PNG 或 WebP，HEIC 请先导出为 JPG。");
              return;
            }
            if (file.size > 12 * 1024 * 1024) {
              setError("图片超过 12 MB，请选择较小图片。");
              return;
            }
            setLoading(true);
            const url = URL.createObjectURL(file);
            try {
              const preview = new Image();
              preview.src = url;
              await preview.decode();
              if (!alive.current || gen !== generation.current) {
                URL.revokeObjectURL(url);
                return;
              }
              if (preview.naturalWidth * preview.naturalHeight > 40000000)
                throw new Error("图片尺寸超过 4000 万像素，请缩小后重试。");
              setPhoto({ url, name: file.name });
            } catch (err) {
              URL.revokeObjectURL(url);
              if (alive.current && gen === generation.current)
                setError(
                  err instanceof Error && err.message.startsWith("图片尺寸")
                    ? err.message
                    : "无法读取图片，请重新选择。",
                );
            } finally {
              if (alive.current && gen === generation.current)
                setLoading(false);
            }
          }}
        />
      </label>
      {photo && <small>{photo.name}</small>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
export default function PersonalComparePage({
  first,
  second,
  setFirst,
  setSecond,
  onSave,
}: {
  first: LocalPhoto | null;
  second: LocalPhoto | null;
  setFirst: (p: LocalPhoto | null) => void;
  setSecond: (p: LocalPhoto | null) => void;
  onSave: (r: CompareRecord) => boolean;
}) {
  const [mode, setMode] = useState<"pair" | "a" | "b">("pair");
  const [zoom, setZoom] = useState(1);
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const [preference, setPreference] = useState<
    CompareRecord["preference"] | ""
  >("");
  const [goal, setGoal] = useState("观察前后变化");
  const [reason, setReason] = useState("");
  const [recorded, setRecorded] = useState(false);
  const [saveRejected, setSaveRejected] = useState(false);
  const validGoal = isValidComparisonGoal(goal);
  const validReason = isSafeLocalText(reason, 240, true);
  const recordId = useRef(crypto.randomUUID());
  useEffect(() => {
    setPreference("");
    setRecorded(false);
    setSaveRejected(false);
    setZoom(1);
    setX(50);
    setY(50);
    recordId.current = crypto.randomUUID();
  }, [first, second]);
  function view(photo: LocalPhoto | null, label: string) {
    return (
      <figure className="frame-photo-frame">
        <div>
          {photo ? (
            <img
              src={photo.url}
              alt={`${label} · 个人照片，仅本机预览`}
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: `${x}% ${y}%`,
              }}
            />
          ) : (
            <span>选择{label}后在这里查看</span>
          )}
        </div>
        <figcaption>{label} · 个人图片</figcaption>
      </figure>
    );
  }
  return (
    <div className="page frame-personal">
      <a href="#/coach" className="back-link">
        <ArrowLeft size={15} />
        返回示例指导，保留进度
      </a>
      <div className="page-intro">
        <h1>照片对比</h1>
        <p>
          选择两张照片，手动比较。图片仅在本机预览，无 AI
          点评；刷新后需重新选择。
        </p>
      </div>
      <div className="frame-form-grid">
        <Picker label="原图 A" photo={first} setPhoto={setFirst} />
        <Picker label="重拍图 B" photo={second} setPhoto={setSecond} />
      </div>
      <div className="frame-actions frame-photo-controls">
        {(["pair", "a", "b"] as const).map((m) => (
          <button
            key={m}
            className={`button ${mode === m ? "primary" : "secondary"}`}
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
          >
            {m === "pair" ? "并排查看" : m === "a" ? "查看 A" : "查看 B"}
          </button>
        ))}
        <button
          className="button ghost"
          onClick={() => {
            setZoom(1);
            setX(50);
            setY(50);
          }}
        >
          <RotateCcw size={15} />
          重置视图
        </button>
      </div>
      <div className={`frame-photo-pair ${mode === "pair" ? "" : "single"}`}>
        {mode !== "b" && view(first, "原图 A")}
        {mode !== "a" && view(second, "重拍图 B")}
      </div>
      <div className="frame-form-grid frame-photo-sliders">
        <label>
          同步缩放 {zoom.toFixed(1)}×
          <input
            type="range"
            min="1"
            max="3"
            step="0.1"
            aria-label="个人图片同步缩放"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>
        <label>
          观察位置（左右）
          <input
            type="range"
            min="0"
            max="100"
            aria-label="个人图片水平位置"
            value={x}
            onChange={(e) => setX(Number(e.target.value))}
          />
        </label>
        <label>
          观察位置（上下）
          <input
            type="range"
            min="0"
            max="100"
            aria-label="个人图片垂直位置"
            value={y}
            onChange={(e) => setY(Number(e.target.value))}
          />
        </label>
      </div>
      <p className="fine-print">
        同步的是缩放与相对观察位置，不保证不同构图像素完全对齐。
      </p>
      <section className="frame-panel">
        <h2>记录偏好</h2>
        <div className="frame-form-grid">
          <label>
            本次观察目标
            <input
              value={goal}
              maxLength={120}
              aria-invalid={!validGoal}
              aria-describedby="personal-save-status"
              onChange={(e) => {
                setGoal(e.target.value);
                setRecorded(false);
                setSaveRejected(false);
              }}
            />
          </label>
          <label>
            原因（可不填）
            <input
              value={reason}
              maxLength={200}
              aria-invalid={!validReason}
              aria-describedby="personal-save-status"
              onChange={(e) => {
                setReason(e.target.value);
                setRecorded(false);
                setSaveRejected(false);
              }}
            />
          </label>
        </div>
        <div className="frame-actions">
          {(["before", "after", "both", "unsure"] as const).map((p) => (
            <button
              key={p}
              className={`button ${preference === p ? "primary" : "secondary"}`}
              aria-pressed={preference === p}
              onClick={() => {
                setPreference(p);
                setRecorded(false);
              }}
            >
              {preferenceLabel(p)}
            </button>
          ))}
        </div>
        <button
          className="button primary"
          disabled={
            !first ||
            !second ||
            !preference ||
            !validGoal ||
            !validReason ||
            recorded
          }
          onClick={() => {
            if (!preference || !validGoal || !validReason) return;
            const accepted = onSave({
              id: recordId.current,
              source: "personal",
              preference,
              goal: goal.trim(),
              reason,
              createdAt: new Date().toISOString(),
            });
            setRecorded(accepted);
            setSaveRejected(!accepted);
          }}
        >
          {recorded ? "已保存判断" : "保存到本机记录"}
        </button>
        <p id="personal-save-status" role="status" className="fine-print">
          {recorded
            ? "已保存偏好，图片本身未长期保存。"
            : (!validGoal && goal.trim()) || !validReason
              ? "目标与原因请填写普通文字，不包含网址或控制字符。"
              : saveRejected
                ? "这次判断未能记录，请检查输入后重试。"
                : "请选择两张图片和一个偏好，再保存。"}
        </p>
      </section>
    </div>
  );
}
