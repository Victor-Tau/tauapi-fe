import { useEffect, useRef, useState } from "react"

import { useReducedMotion } from "@/components/app-shell/use-reduced-motion"
import { cn } from "@/lib/utils"

/**
 * Blip — the animated MLTVRS mascot logo (design: blip.html).
 * Hover fans the parallel-universe echoes out and the eyes glance at them;
 * clicking cycles through the expression states. Colours are theme tokens
 * in styles/blip.css (light = logo-light.svg, dark = logo-dark.svg).
 */

export const BLIP_STATES = [
  "idle",
  "think",
  "code",
  "happy",
  "portal",
  "sleep",
] as const
export type BlipState = (typeof BLIP_STATES)[number]

const STORAGE_KEY = "blip-state"
const HOVER_DELAY = 100
const SETTLE_MS = 650
const SETTLE_EASE = "cubic-bezier(0.45, 0, 0.25, 1)"

const BODY =
  "M 76 70 H 100 V 84 H 140 V 70 H 164 V 98 H 180 V 140 H 164 V 170 H 138 V 152 H 102 V 170 H 76 V 140 H 60 V 98 H 76 Z"

const PLATE =
  "M 62,20 H 178 C 202,20 220,38 220,62 V 178 C 220,202 202,220 178,220 H 62 C 38,220 20,202 20,178 V 62 C 20,38 38,20 62,20 Z"

function readStored(): BlipState {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v && (BLIP_STATES as readonly string[]).includes(v))
      return v as BlipState
  } catch {
    /* storage unavailable */
  }
  return "idle"
}

function Eyes({ state }: { state: BlipState }) {
  switch (state) {
    case "think":
      return (
        <g className="blip-eye-fill">
          <rect x="84" y="111" width="20" height="8" rx="4" />
          <rect x="137" y="103" width="18" height="18" rx="6" />
        </g>
      )
    case "code":
      return (
        <g className="blip-eye-stroke">
          <polyline points="87,106 99,114 87,122" />
          <polyline points="153,106 141,114 153,122" />
        </g>
      )
    case "happy":
      return (
        <g className="blip-eye-stroke">
          <path d="M 85 118 Q 94 105 103 118" />
          <path d="M 137 118 Q 146 105 155 118" />
        </g>
      )
    case "sleep":
      return (
        <g className="blip-eye-fill">
          <rect x="84" y="112" width="20" height="6" rx="3" />
          <rect x="136" y="112" width="20" height="6" rx="3" />
        </g>
      )
    default:
      return (
        <g className="blip-eye-fill">
          <rect x="86" y="103" width="16" height="22" rx="6" />
          <rect x="138" y="103" width="16" height="22" rx="6" />
        </g>
      )
  }
}

export function BlipLogo({
  className,
  interactive = true,
}: {
  className?: string
  interactive?: boolean
}) {
  const [state, setState] = useState<BlipState>(readStored)
  const [active, setActive] = useState(false)
  const hoverTimer = useRef<number | undefined>(undefined)
  const popRef = useRef<SVGGElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const settling = useRef<Animation[]>([])
  const reduced = useReducedMotion()

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, state)
    } catch {
      /* storage unavailable */
    }
  }, [state])

  useEffect(() => () => window.clearTimeout(hoverTimer.current), [])

  // Wake only after the pointer has rested for 100ms (ignores fly-overs);
  // leaving lets Blip settle slowly back into its static pose.
  function handleEnter(event: React.PointerEvent) {
    if (!interactive || event.pointerType !== "mouse") return
    window.clearTimeout(hoverTimer.current)
    hoverTimer.current = window.setTimeout(() => {
      // Re-hovered mid-settle: drop the settle so the loops take over cleanly.
      settling.current.forEach((a) => a.cancel())
      settling.current = []
      setActive(true)
    }, HOVER_DELAY)
  }

  function handleLeave() {
    window.clearTimeout(hoverTimer.current)
    if (!active) return
    // Looping keyframes (float/bounce/glitch) would snap to rest when they
    // are removed, so capture their current pose and ease it back to zero.
    const looping = reduced
      ? []
      : Array.from(
          svgRef.current?.querySelectorAll<SVGElement>(
            ".blip-float, .blip-echo"
          ) ?? []
        ).map((el) => {
          const cs = getComputedStyle(el)
          return { el, translate: cs.translate, scale: cs.scale }
        })
    setActive(false)
    settling.current = []
    for (const { el, translate, scale } of looping) {
      if (translate === "none" && scale === "none") continue
      const anim = el.animate(
        [
          { translate, scale },
          { translate: "0 0", scale: "1 1" },
        ],
        { duration: SETTLE_MS, easing: SETTLE_EASE }
      )
      settling.current.push(anim)
    }
  }

  function handleClick() {
    if (!interactive) return
    setState(
      (s) => BLIP_STATES[(BLIP_STATES.indexOf(s) + 1) % BLIP_STATES.length]
    )
    if (!reduced && popRef.current?.animate) {
      // Squash-and-stretch from the feet, then spring back.
      popRef.current.animate(
        [
          { transform: "scale(1, 1)" },
          { transform: "scale(1.1, 0.86)", offset: 0.25 },
          { transform: "scale(0.94, 1.08)", offset: 0.6 },
          { transform: "scale(1, 1)" },
        ],
        { duration: 420, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" }
      )
    }
  }

  return (
    <svg
      ref={svgRef}
      viewBox="20 20 200 200"
      aria-hidden="true"
      focusable="false"
      data-state={state}
      data-interactive={interactive}
      data-active={active}
      className={cn("blip", className)}
      onClick={handleClick}
      onPointerEnter={handleEnter}
      onPointerLeave={handleLeave}
    >
      <path d={PLATE} className="blip-plate" />
      <g className="blip-center">
        <g ref={popRef} className="blip-pop">
          <g className="blip-float">
            <g className="blip-echo blip-echo-2">
              <path d={BODY} />
            </g>
            <g className="blip-echo blip-echo-1">
              <path d={BODY} />
            </g>
            <g className="blip-body">
              <path d={BODY} className="blip-shape" />
              <path
                d="M 76 73 Q 86 68 95 73"
                className="blip-crease blip-crease-minor"
                strokeWidth="3.5"
              />
              <path
                d="M 76 135 Q 84 141 92 137"
                className="blip-crease blip-crease-minor"
                strokeWidth="4"
              />
              <path
                d="M 148 137 Q 156 141 164 135"
                className="blip-crease blip-crease-minor"
                strokeWidth="4"
              />
              <path
                d="M 104 144 Q 120 155 136 144"
                className="blip-crease blip-crease-smile"
              />
              <g className="blip-look">
                <g key={state} className="blip-eyes">
                  <Eyes state={state} />
                </g>
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>
  )
}
