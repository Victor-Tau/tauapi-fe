import { useId, type CSSProperties, type ReactNode } from "react"

import { GraduationCapIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * VIP avatar frame: a thin ring around a round avatar, 0.5px away, plus an
 * optional corner badge on the top-right (the student discount's mortarboard).
 * `level` is the account's `vip_level` from `/api/user/self`; level 0, a
 * custom group (null) or a missing value draws no frame. Bronze and silver
 * are static; gold, platinum and diamond rotate their sheen, faster per
 * tier, and diamond adds tiny sparkles (styles/avatar-frame.css).
 *
 * The ring is an SVG stroke (no CSS masks), drawn outside the avatar's box,
 * so it renders the same in every browser and never changes layout.
 */

/** Gradient stops per level, 1–5. */
const STOPS: Record<number, string[]> = {
  1: ["#8a4a24", "#e0a077", "#b4693a"],
  2: ["#64748b", "#f1f5f9", "#94a3b8"],
  3: ["#b7791f", "#fde68a", "#d08a2a"],
  4: ["#0e7490", "#a5f3fc", "#0e9fb0"],
  5: ["#7c5cf0", "#f0abfc", "#67e8f9", "#f472b6"],
}

/** Gap between avatar and ring, the same at every size. */
const GAP = 0.5
/**
 * The ring's svg extends this many whole pixels past the avatar on every
 * side. A whole-pixel offset keeps the svg on the same pixel grid as the
 * avatar; a fractional one is snapped by the browser, which made the gap
 * tight on one side and loose on the other.
 */
const RING_BOX = 3
/** [ring width, badge size] in px per size. */
const SIZES = {
  sm: [1.3, 14],
  md: [1.5, 16],
  lg: [2, 22],
} as const

/** Corner badges hung on the frame's top-right. */
export type FrameBadge = "student"

export function AvatarFrame({
  level,
  badge,
  size = "md",
  className,
  children,
}: {
  level: number | null | undefined
  /** Corner accessory, e.g. a mortarboard for the student discount. */
  badge?: FrameBadge
  /** sm for ~32px avatars, md ~56px, lg ~96px. */
  size?: "sm" | "md" | "lg"
  className?: string
  children: ReactNode
}) {
  // useId output may contain characters that break url(#…) references.
  const id = `vip-frame-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`
  const tier = level && level >= 1 ? Math.min(level, 5) : 0
  if (!tier && !badge) return <>{children}</>
  const stops = STOPS[tier]
  const [width, badgeSize] = SIZES[size]
  const style = {
    "--frame-out": `${tier ? GAP + width : 0}px`,
    "--ring-inset": `${-RING_BOX}px`,
    "--badge": `${badgeSize}px`,
  } as CSSProperties

  return (
    <span
      data-slot="avatar-frame"
      data-vip-frame={tier}
      data-size={size}
      className={cn("avatar-frame", className)}
      style={style}
    >
      {children}
      {stops && (
      <svg aria-hidden className="avatar-frame-ring">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            {stops.map((color, index) => (
              <stop
                key={index}
                offset={index / (stops.length - 1)}
                stopColor={color}
              />
            ))}
          </linearGradient>
        </defs>
        <circle
          cx="50%"
          cy="50%"
          r="48%"
          // Radius in px from the svg edge, so the gap is exact on every side.
          style={{ r: `calc(50% - ${RING_BOX - GAP - width / 2}px)` } as CSSProperties}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={width}
        />
      </svg>
      )}
      {badge === "student" && (
        // A small disc with the 大学生优惠 badge's line-art cap.
        <span
          role="img"
          aria-label="大学生优惠"
          className="avatar-frame-badge text-[#2f5de0]"
        >
          <GraduationCapIcon />
        </span>
      )}
      {tier >= 5 && (
        <>
          <i aria-hidden className="avatar-frame-spark" />
          <i aria-hidden className="avatar-frame-spark" />
          <i aria-hidden className="avatar-frame-spark" />
        </>
      )}
    </span>
  )
}
