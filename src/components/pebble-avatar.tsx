import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import type { PebbleConfig } from "@/types/api"

/**
 * Pebble — the user avatar (design: pebble.html). Users may save their own
 * look (`/api/user/self` → `pebble`); otherwise top accessory, eyes and
 * palette are picked from the user ID, so the same account always gets the
 * same Pebble on every device. Indices are stored by the backend, so options
 * may only ever be appended, never reordered.
 */

const BODY =
  "M 84 78 H 156 V 96 H 172 V 134 H 156 V 162 H 136 V 148 H 104 V 162 H 84 V 134 H 68 V 96 H 84 Z"

const TRAITS: ReactNode[] = [
  // Signal sprout
  <path key="sprout" d="M 120 68 V 52 M 112 50 H 128" strokeWidth="13" />,
  // Plain hoodie
  null,
  // Parallel-universe halo
  <ellipse
    key="halo"
    cx="120"
    cy="50"
    rx="22"
    ry="5.5"
    fill="none"
    strokeWidth="8"
  />,
  // Bear hood ears
  <g key="ears" strokeWidth="10">
    <rect x="78" y="60" width="14" height="14" rx="7" />
    <rect x="148" y="60" width="14" height="14" rx="7" />
  </g>,
]

function eyes(index: number, color: string): ReactNode {
  switch (index) {
    case 1: // ^ ^
      return (
        <g fill="none" stroke={color} strokeWidth="5.5" strokeLinecap="round">
          <path d="M 89 114 Q 98 101 107 114" />
          <path d="M 133 114 Q 142 101 151 114" />
        </g>
      )
    case 2: // geek glasses
      return (
        <g stroke={color} strokeWidth="4.5">
          <rect x="84" y="99" width="26" height="22" rx="6" fill="none" />
          <rect x="130" y="99" width="26" height="22" rx="6" fill="none" />
          <line x1="110" y1="108" x2="130" y2="108" />
          <circle cx="97" cy="110" r="4" fill={color} stroke="none" />
          <circle cx="143" cy="110" r="4" fill={color} stroke="none" />
        </g>
      )
    case 3: // wink
      return (
        <g fill={color}>
          <path
            d="M 89 104 L 103 111 L 89 118"
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="135" y="102" width="14" height="18" rx="7" />
        </g>
      )
    case 4: // – –
      return (
        <g fill={color}>
          <rect x="88" y="108" width="18" height="6" rx="3" />
          <rect x="134" y="108" width="18" height="6" rx="3" />
        </g>
      )
    default: // ● ●
      return (
        <g fill={color}>
          <rect x="91" y="102" width="14" height="18" rx="7" />
          <rect x="135" y="102" width="14" height="18" rx="7" />
        </g>
      )
  }
}

const EYE_COUNT = 5

// [background, ink, echo]
const PALETTES = [
  ["#EAEAEA", "#080808", "#D97757"],
  ["#F5E6DF", "#2C221E", "#D97757"],
  ["#E5ECF6", "#1B2B48", "#4A90E2"],
  ["#E6F4EA", "#173826", "#34A853"],
  ["#EFE8F8", "#2A1B4E", "#8E55EA"],
  ["#252529", "#EAEAEA", "#D97757"],
] as const

/**
 * Vertical offset per top accessory. The figure spans x 59–190 and from the
 * accessory's top (incl. the echo, raised 7) down to y 171; these centre that
 * box in the 240 canvas: sprout top 36.5, hoodie 62, halo 33.5, ears 48.
 */
const TRAIT_OFFSET_Y = [16, 3.5, 18, 10.5]
const OFFSET_X = -4.5

/** Integer mix so neighbouring IDs (#8492, #8493…) don't look alike. */
function hash(id: number): number {
  let h = (id | 0) ^ 0x9e3779b9
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return (h ^ (h >>> 16)) >>> 0
}

/** Option names, by stored index. */
export const PEBBLE_TRAIT_NAMES = [
  "信号小豆芽",
  "纯净连帽衫",
  "平行宇宙光环",
  "小熊连帽耳",
] as const
export const PEBBLE_EYE_NAMES = [
  "乖巧萌新",
  "开心冲浪",
  "极客黑框镜",
  "眨眼俏皮",
  "佛系潜水",
] as const
export const PEBBLE_PALETTE_NAMES = [
  "经典黑",
  "暖陶棕",
  "星际漫游蓝",
  "终端矩阵绿",
  "量子折跃紫",
  "暗黑反色",
] as const

/** [background, ink] of a palette, for swatches. */
export function pebbleSwatch(palette: number): readonly [string, string] {
  const [bg, ink] = PALETTES[palette] ?? PALETTES[0]
  return [bg, ink]
}

/** The default Pebble of a user ID. */
export function pebbleTraits(id: number): PebbleConfig {
  const h = hash(id)
  return {
    trait: h % TRAITS.length,
    eyes: Math.floor(h / TRAITS.length) % EYE_COUNT,
    palette: Math.floor(h / (TRAITS.length * EYE_COUNT)) % PALETTES.length,
    blush: true,
  }
}

/** The look to draw: the saved one, with unknown indices falling back to the ID default. */
export function resolvePebble(
  id: number,
  saved: PebbleConfig | null | undefined
): PebbleConfig {
  const base = pebbleTraits(id)
  if (!saved) return base
  const pick = (value: number, count: number, fallback: number) =>
    Number.isInteger(value) && value >= 0 && value < count ? value : fallback
  return {
    trait: pick(saved.trait, TRAITS.length, base.trait),
    eyes: pick(saved.eyes, EYE_COUNT, base.eyes),
    palette: pick(saved.palette, PALETTES.length, base.palette),
    blush: saved.blush,
  }
}

export function PebbleAvatar({
  id,
  pebble,
  className,
}: {
  id: number
  /** Saved custom look; null/undefined draws the ID default. */
  pebble?: PebbleConfig | null
  className?: string
}) {
  const t = resolvePebble(id, pebble)
  const [bg, ink, echo] = PALETTES[t.palette]
  // The light-ink (dark) palette needs dark eyes.
  const eyeColor = ink === "#EAEAEA" ? "#161618" : "#FFFFFF"
  const trait = TRAITS[t.trait]

  return (
    <svg
      viewBox="0 0 240 240"
      aria-hidden="true"
      focusable="false"
      data-slot="pebble-avatar"
      className={cn("size-8 shrink-0 rounded-full", className)}
    >
      <rect width="240" height="240" fill={bg} />
      <g transform={`translate(${OFFSET_X}, ${TRAIT_OFFSET_Y[t.trait] ?? 0})`}>
        <g
          transform="translate(9, -7)"
          opacity="0.28"
          fill={echo}
          stroke={echo}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          {trait}
          <path d={BODY} strokeWidth="18" />
        </g>
        <g fill={ink} stroke={ink} strokeLinejoin="round" strokeLinecap="round">
          {trait}
          <path d={BODY} strokeWidth="18" />
        </g>
        <path
          d="M 82 80 Q 96 73 110 78"
          fill="none"
          stroke={bg}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M 86 134 Q 120 148 154 134"
          fill="none"
          stroke={bg}
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        {eyes(t.eyes, eyeColor)}
        {t.blush && (
          <g fill="#FF7B72" opacity="0.85">
            <rect x="74" y="116" width="10" height="6" rx="3" />
            <rect x="156" y="116" width="10" height="6" rx="3" />
          </g>
        )}
      </g>
    </svg>
  )
}
