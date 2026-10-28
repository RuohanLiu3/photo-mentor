import { useId } from "react";
import type { Annotation, Frame } from "../../coaching";

/** Original vector teaching scenes. Every variant corresponds to the fixture action ID. */
export default function FixtureScene({
  frame,
  annotation,
}: {
  frame: Frame;
  annotation?: Annotation;
}) {
  const uid = useId().replace(/:/g, "");
  const adjusted = frame.variant === "adjusted";
  const action = adjusted ? frame.actionId : "original";
  const environment = frame.scenarioId === "environment";
  const light = frame.scenarioId === "light";
  const title = environment ? "山间旅行人像" : light ? "窗边人像" : "街角人像";
  const personX = environment
    ? action === "environment-subject"
      ? 465
      : 316
    : light
      ? action === "light-viewpoint"
        ? 399
        : 420
      : action === "overlap-subject"
        ? 255
        : action === "overlap-camera"
          ? 329
          : 364;
  const bgShift = action === "overlap-camera" ? 83 : 0;
  const scale = environment
    ? action === "environment-wide"
      ? 1
      : action === "environment-tight"
        ? 1.53
        : 1.19
    : 1;
  const brightFace = action === "light-turn" || action === "light-viewpoint";
  const sceneLabel = !adjusted
    ? "原始构图"
    : action === "overlap-subject"
      ? "人物左移，路灯和机位保持不变"
      : action === "overlap-camera"
        ? "视点变化，头部与路灯分开"
        : action === "environment-subject"
          ? "人物右移，露出山形标志"
          : action === "environment-wide"
            ? "视角放宽，环境占比增加"
            : action === "environment-tight"
              ? "取景收紧，人物占比增加"
              : action === "light-turn"
                ? "人物转向窗光，亮面更可见"
                : "改变观察角度，更多受光区域可见";
  return (
    <svg
      className="coach-scene"
      viewBox={light ? "150 0 405 540" : "0 0 720 540"}
      role="img"
      aria-label={`${title}原创教学图，${sceneLabel}。不是真实照片。`}
    >
      <defs>
        <linearGradient id={`${uid}-sky`} x2="0" y2="1">
          <stop stopColor="#cbdedc" />
          <stop offset="1" stopColor="#edf0d5" />
        </linearGradient>
        <linearGradient id={`${uid}-wall`} x2="1" y2="1">
          <stop stopColor="#ece4ce" />
          <stop offset="1" stopColor="#9cae99" />
        </linearGradient>
        <linearGradient id={`${uid}-coat`} x2="1" y2="1">
          <stop stopColor="#deac66" />
          <stop offset="1" stopColor="#b77943" />
        </linearGradient>
        <linearGradient id={`${uid}-face`}>
          <stop stopColor="#e6bc8d" offset={brightFace ? ".65" : ".12"} />
          <stop stopColor="#8e6c58" offset={brightFace ? ".9" : ".35"} />
        </linearGradient>
        <clipPath id={`${uid}-clip`}>
          <rect width="720" height="540" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${uid}-clip)`}>
        <rect
          width="720"
          height="540"
          fill={`url(#${uid}-${environment ? "sky" : "wall"})`}
        />
        <g
          transform={`translate(${360 * (1 - scale)} ${275 * (1 - scale)}) scale(${scale})`}
        >
          {environment ? (
            <>
              <circle cx="593" cy="89" r="36" fill="#f6e6ab" />
              <path
                d="M-80 330L151 90L303 282L463 59L806 370Z"
                fill="#8fae9f"
              />
              <path
                d="M280 292L463 59L683 260L569 218L481 145L426 221Z"
                fill="#d6e1cb"
              />
              <path
                d="M-50 371L189 220L364 370L550 211L790 350V550H-50Z"
                fill="#527d71"
              />
              <path d="M0 368Q317 294 720 386V540H0Z" fill="#afbd94" />
              <path d="M295 540L371 376H456L501 540Z" fill="#e7d4ae" />
              <path
                d="M0 396L720 416M51 393V490M146 395V476M570 410V511M672 414V532"
                stroke="#536f55"
                strokeWidth="8"
              />
              <rect
                x="219"
                y="237"
                width="120"
                height="102"
                rx="7"
                fill="#f3e6ba"
                stroke="#57766a"
                strokeWidth="7"
              />
              <path
                d="M238 292L260 264L277 284L299 257L321 292Z"
                fill="#608576"
              />
              <path d="M242 311H315" stroke="#a6ae8b" strokeWidth="5" />
              <path
                d="M235 340V434M326 340V426"
                stroke="#597563"
                strokeWidth="9"
              />
            </>
          ) : light ? (
            <>
              <g
                transform={`translate(${action === "light-viewpoint" ? -34 : 0} 0)`}
              >
                <rect
                  x="50"
                  y="44"
                  width="230"
                  height="341"
                  rx="5"
                  fill="#f7f2dc"
                />
                <rect x="63" y="57" width="204" height="314" fill="#c5d9d4" />
                <path
                  d="M75 57L236 371M149 57L267 276"
                  stroke="#e5f0df"
                  strokeWidth="30"
                  opacity=".7"
                />
                <path
                  d="M165 57V373M63 203H267"
                  stroke="#fbf5df"
                  strokeWidth="10"
                />
                <rect x="34" y="381" width="261" height="17" fill="#b1bba6" />
              </g>
              <path
                d="M63 371L345 180L653 540H78Z"
                fill="#fff3b6"
                opacity=".18"
              />
              <rect y="434" width="720" height="106" fill="#9baf9d" />
              <path
                d="M571 213V427M616 230V430"
                stroke="#668371"
                strokeWidth="6"
              />
              <path
                d="M572 261Q522 227 541 207Q578 213 572 261M573 312Q626 273 637 289Q619 321 573 312M615 269Q660 232 666 253Q651 278 615 269"
                fill="#688b6c"
              />
              <path d="M554 405H639L622 471H569Z" fill="#b48b6e" />
            </>
          ) : (
            <>
              <g transform={`translate(${bgShift} 0)`}>
                <rect x="54" y="42" width="240" height="331" fill="#e3e2cb" />
                <rect x="69" y="57" width="210" height="301" fill="#53766d" />
                <path
                  d="M174 57V358M69 201H279"
                  stroke="#c2cbbb"
                  strokeWidth="10"
                />
                <path
                  d="M90 57L233 358"
                  stroke="#dfe8cc"
                  strokeWidth="28"
                  opacity=".14"
                />
                <rect x="481" y="56" width="191" height="327" fill="#708e7e" />
                <rect x="493" y="72" width="167" height="300" fill="#3d6358" />
                <path
                  d="M492 228H660M520 72V372M633 72V372"
                  stroke="#75927d"
                  strokeWidth="6"
                />
                <path d="M364 116V435" stroke="#44685d" strokeWidth="9" />
                <path d="M338 126H390L380 97H349Z" fill="#31574c" />
                <rect
                  x="348"
                  y="126"
                  width="33"
                  height="33"
                  rx="4"
                  fill="#eed99e"
                />
              </g>
              <rect y="419" width="720" height="121" fill="#a4b59f" />
              <path
                d="M0 459H720M0 517H720M110 420L-10 540M280 420L251 540M492 420L549 540"
                stroke="#829d87"
                strokeWidth="2"
              />
              <ellipse cx="601" cy="405" rx="65" ry="14" fill="#dad8b5" />
              <path
                d="M574 410L558 491M627 410L645 491"
                stroke="#44675a"
                strokeWidth="7"
              />
              <path d="M597 373H621L617 401H601Z" fill="#bd8c67" />
              <path
                d="M608 373V343M608 363Q579 334 591 331Q610 335 608 363M608 357Q629 333 635 342Q628 357 608 357"
                fill="#5b8261"
              />
            </>
          )}
          <g
            transform={`translate(${personX} ${environment ? 61 : 32}) scale(${environment ? 0.91 : 1})`}
          >
            <ellipse
              cx="0"
              cy="466"
              rx="55"
              ry="10"
              fill="#4d715d"
              opacity=".25"
            />
            <path
              d="M-22 330L-28 451M20 330L33 451"
              stroke="#425b60"
              strokeWidth="26"
            />
            <path
              d="M-43 460H-14M20 460H48"
              stroke="#eae7d2"
              strokeWidth="14"
              strokeLinecap="round"
            />
            <path
              d="M-25 223Q-43 227-42 269L-34 345H39L37 267Q32 228 17 223Z"
              fill={`url(#${uid}-coat)`}
            />
            <path
              d="M-34 242L-58 301M32 239L58 293"
              stroke="#c38b4b"
              strokeWidth="20"
              strokeLinecap="round"
            />
            <path
              d="M-58 301L-51 317M58 293L64 308"
              stroke="#c99771"
              strokeWidth="12"
              strokeLinecap="round"
            />
            <path d="M-9 209V232Q3 242 14 227V204" fill="#c8966e" />
            <g transform={action === "light-turn" ? "rotate(-10 0 186)" : ""}>
              <ellipse
                cx="0"
                cy="187"
                rx="28"
                ry="37"
                fill={light ? `url(#${uid}-face)` : "#d9ae80"}
              />
              <path
                d="M-26 194Q-39 144-4 143Q36 142 29 184L20 171Q-4 181-16 158L-21 195Z"
                fill="#39443b"
              />
              <path
                d={`M${brightFace ? -3 : 7} 190l4 8h-6`}
                stroke="#9a6d53"
                strokeWidth="2"
                fill="none"
              />
              <path
                d="M-3 209Q4 213 11 207"
                stroke="#8c604d"
                strokeWidth="2"
                fill="none"
              />
            </g>
            <path
              d="M-14 230L-1 258L13 229M-1 259L5 336"
              stroke="#e8bf7c"
              strokeWidth="3"
              fill="none"
            />
          </g>
        </g>
      </g>
      {annotation && (
        <g>
          <rect
            x={(annotation.x * frame.width) / 100 + (light ? 150 : 0)}
            y={annotation.y * 5.4}
            width={(annotation.width * frame.width) / 100}
            height={annotation.height * 5.4}
            rx="10"
            fill="#e4f5a0"
            fillOpacity=".08"
            stroke="#efffb3"
            strokeWidth="3"
            strokeDasharray="9 6"
          />
          <rect
            x={(annotation.x * frame.width) / 100 + (light ? 150 : 0)}
            y={annotation.y * 5.4 - 30}
            width="193"
            height="27"
            rx="6"
            fill="#243e31"
          />
          <text
            x={(annotation.x * frame.width) / 100 + (light ? 150 : 0) + 9}
            y={annotation.y * 5.4 - 11}
            fontSize="14"
            fill="#f2f4dc"
          >
            {annotation.label}
          </text>
        </g>
      )}
    </svg>
  );
}
