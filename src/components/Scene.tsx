import { useId } from "react";
import { DEFAULT_SIM, exposureDelta, type SimSettings } from "../domain";

type Props = {
  settings?: SimSettings;
  mode?: "motion" | "depth" | "composition" | "hero";
  variant?: "before" | "after" | "context";
  grid?: boolean;
};

/** Original teaching diagram, not an optically accurate camera simulation. */
export default function Scene({
  settings = DEFAULT_SIM,
  mode = "hero",
  variant,
  grid = false,
}: Props) {
  const uid = useId().replace(/:/g, "");
  const angle =
    variant === "after"
      ? 1
      : variant === "context"
        ? 2
        : variant === "before"
          ? 0
          : settings.viewpoint;
  const personX = angle === 1 ? 248 : angle === 2 ? 270 : 365;
  const small = angle === 2;
  const blur = mode === "depth" ? [7, 5, 2.5, 1, 0][settings.apertureIndex] : 0;
  const motion =
    mode === "motion" ? [26, 18, 10, 5, 0, 0][settings.shutterIndex] : 0;
  const delta = mode === "motion" ? exposureDelta(settings) : 0;
  const background = `${uid}-background`;
  return (
    <svg
      viewBox="0 0 720 500"
      role="img"
      aria-label={`原创教学场景：人物、窗框与立柱。${angle === 1 ? "侧移后人物与立柱分开" : angle === 2 ? "环境构图示意，人物占比缩小，环境更突出" : "正面视点，立柱与人物头部重叠"}。`}
      className="scene"
    >
      <defs>
        <linearGradient id={`${uid}-wall`} x2="1" y2="1">
          <stop stopColor="#d4dbd5" />
          <stop offset="1" stopColor="#8da39b" />
        </linearGradient>
        <linearGradient id={`${uid}-glass`} x2="1" y2="1">
          <stop stopColor="#304c58" />
          <stop offset="1" stopColor="#657b7e" />
        </linearGradient>
        <linearGradient id={`${uid}-coat`} x2="1" y2="1">
          <stop stopColor="#d39551" />
          <stop offset="1" stopColor="#a36534" />
        </linearGradient>
        <filter id={background} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={blur} />
        </filter>
      </defs>
      <rect width="720" height="500" fill={`url(#${uid}-wall)`} />
      <g filter={`url(#${background})`}>
        <path d="M0 0H214L430 420H0Z" fill="#e8e4cc" opacity=".75" />
        <rect x="70" y="38" width="232" height="310" rx="3" fill="#dee1d5" />
        <rect
          x="81"
          y="50"
          width="208"
          height="284"
          fill={`url(#${uid}-glass)`}
        />
        <path
          d="M100 60L244 324M218 60L287 183"
          stroke="#c3d8d4"
          strokeWidth="35"
          opacity=".12"
        />
        <path d="M184 50V334M81 187H289" stroke="#dbded1" strokeWidth="9" />
        <rect x="58" y="345" width="252" height="13" fill="#a6b5a7" />
        <rect x="479" y="37" width="177" height="324" fill="#738e84" />
        <rect x="489" y="48" width="158" height="312" fill="#3e5b55" />
        <path
          d="M512 48V360M624 48V360M489 210H647"
          stroke="#648477"
          strokeWidth="6"
        />
        <rect y="375" width="720" height="125" fill="#adbcab" />
        <path
          d="M0 378H720M0 427H720M0 485H720M116 375L8 500M285 375L254 500M453 375L500 500M620 375L740 500"
          fill="none"
          stroke="#86998a"
          strokeWidth="2"
          opacity=".5"
        />
        <path d="M366 125V384" stroke="#4a6961" strokeWidth="7" />
        <path d="M347 129H385L376 103H357Z" fill="#3a554e" />
        <rect x="354" y="129" width="24" height="24" rx="4" fill="#e7d6a2" />
        <ellipse
          cx="571"
          cy="426"
          rx="71"
          ry="11"
          fill="#819b8b"
          opacity=".5"
        />
        <path
          d="M559 347L547 430M583 347L598 430"
          stroke="#3c5952"
          strokeWidth="6"
        />
        <ellipse cx="571" cy="346" rx="58" ry="12" fill="#c8cead" />
        <path d="M590 315V337" stroke="#527456" strokeWidth="3" />
        <path
          d="M590 324Q565 304 575 298Q596 300 590 324M590 326Q612 306 619 314Q611 330 590 326"
          fill="#678b60"
        />
        <path d="M581 330H601L598 348H584Z" fill="#ae7049" />
        <text
          x="500"
          y="87"
          fill="#d6e1ce"
          opacity=".6"
          fontFamily="serif"
          fontSize="13"
          letterSpacing="5"
        >
          ATELIER
        </text>
      </g>
      <g
        transform={`translate(${personX} ${small ? 103 : 42}) scale(${small ? 0.76 : 1})`}
      >
        <ellipse cy="395" rx="49" ry="10" fill="#60776b" opacity=".4" />
        {motion > 0 &&
          [1, 2, 3].map((i) => (
            <g
              key={i}
              opacity={0.05 * (4 - i)}
              transform={`translate(${-motion * i} 0)`}
            >
              <rect
                x="-34"
                y="185"
                width="68"
                height="104"
                rx="24"
                fill="#d39551"
              />
              <ellipse cy="148" rx="25" ry="32" fill="#493a2c" />
              <path
                d="M-19 285L-25 385M17 285L27 385"
                stroke="#40555c"
                strokeWidth="24"
              />
            </g>
          ))}
        <path
          d="M-20 277L-28 381M17 277L27 381"
          stroke="#3d5360"
          strokeWidth="24"
        />
        <path
          d="M-42 388L-18 387M17 388L42 390"
          stroke="#e2e0d0"
          strokeWidth="13"
          strokeLinecap="round"
        />
        <path
          d="M-21 182Q-40 185-38 223L-31 290H33L35 216Q33 184 16 182Z"
          fill={`url(#${uid}-coat)`}
        />
        <path
          d="M-31 193L-55 254M29 197L51 245"
          stroke="#bb8246"
          strokeWidth="18"
          strokeLinecap="round"
        />
        <path
          d="M-55 254L-47 268M51 245L59 255"
          stroke="#c5906a"
          strokeWidth="11"
          strokeLinecap="round"
        />
        <path d="M-8 171V189Q2 197 12 184V170" fill="#c38d66" />
        <ellipse cy="150" rx="23" ry="30" fill="#d1a17b" />
        <path
          d="M-22 156Q-33 116-3 116Q28 114 25 148L17 139Q-5 146-12 129L-18 158Z"
          fill="#3c3930"
        />
        <path
          d="M-10 204L13 281"
          stroke="#dfb87a"
          strokeWidth="2"
          opacity=".7"
        />
        <path d="M0 195L-7 220L-21 184M7 192L17 213L22 186" fill="#e4b371" />
      </g>
      {mode === "motion" && settings.isoIndex >= 3 && (
        <g opacity={(settings.isoIndex - 2) * 0.04}>
          {Array.from({ length: 130 }, (_, i) => (
            <circle
              key={i}
              cx={(i * 127) % 720}
              cy={(i * 73) % 500}
              r="1.5"
              fill={i % 2 ? "#fff" : "#132632"}
            />
          ))}
        </g>
      )}
      {delta < 0 && (
        <rect
          width="720"
          height="500"
          fill="#10201c"
          opacity={Math.min(0.82, -delta * 0.18)}
        />
      )}
      {delta > 0 && (
        <rect
          width="720"
          height="500"
          fill="#fffbe7"
          opacity={Math.min(0.75, delta * 0.17)}
        />
      )}
      {grid && (
        <path
          d="M240 0V500M480 0V500M0 166.7H720M0 333.3H720"
          stroke="#fff"
          strokeWidth="1"
          opacity=".45"
        />
      )}
      {mode === "hero" && (
        <>
          <path
            d={`M${personX - 48} 150h-16v20m96-20h16v20m-112 96v20h16m96-20v20h-16`}
            fill="none"
            stroke="#e6fb99"
            strokeWidth="2"
          />
          <circle cx={personX} cy="227" r="3" fill="#e6fb99" />
        </>
      )}
    </svg>
  );
}
