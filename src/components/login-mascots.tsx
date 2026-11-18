import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react"

import { useTheme } from "@/components/theme-provider"

// Blip (AI 领航员) and Pebble (人类漫游者) for the login aside. Geometry comes
// from blip.html / pebble.html: each character lives in its own 240×240 box
// centred on (120, 120) and is placed into the shared viewBox below.
//
// Motion runs in one requestAnimationFrame loop with damped springs that
// writes transforms straight to the DOM, so following the pointer never waits
// on React renders or restarts CSS transitions.

const BLIP_BODY =
  "M 76 70 H 100 V 84 H 140 V 70 H 164 V 98 H 180 V 140 H 164 V 170 H 138 V 152 H 102 V 170 H 76 V 140 H 60 V 98 H 76 Z"
const PEBBLE_BODY =
  "M 84 78 H 156 V 96 H 172 V 134 H 156 V 162 H 136 V 148 H 104 V 162 H 84 V 134 H 68 V 96 H 84 Z"
const PEBBLE_SPROUT = "M 120 68 V 52 M 112 50 H 128"
// Echo layers from blip.html in black/grey: the far layer is var(--echo-far)
// (ink black in light mode, grey in dark mode so it still shows on the dark
// background), the near layer is always mid-grey.
const ECHO_GREY = "#99999E"
const ANGER = "#D97757"

// Dark mode: the pair are asleep. A stream of Zs drifts up from beside each
// head; every Z runs the same rise-and-fade loop, offset in time. With reduced
// motion they sit still in a staggered trail instead.
const SNORE_ZS = [
  { delay: 0, x: 0, y: 0, s: 0.7 },
  { delay: -1.1, x: 9, y: -13, s: 0.9 },
  { delay: -2.2, x: 18, y: -26, s: 1.1 },
]

function Snore({ x, y, size }: { x: number; y: number; size: number }) {
  const h = size / 2
  return (
    <g
      className="hidden dark:block"
      transform={`translate(${x} ${y})`}
      fill="none"
      stroke="var(--ink)"
      strokeWidth={size * 0.26}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {SNORE_ZS.map((z) => (
        <g
          key={z.delay}
          className="mascot-snore"
          style={
            {
              animationDelay: `${z.delay}s`,
              "--zx": `${z.x}px`,
              "--zy": `${z.y}px`,
              "--zs": z.s,
            } as CSSProperties
          }
        >
          <path d={`M ${-h} ${-h} H ${h} L ${-h} ${h} H ${h}`} />
        </g>
      ))}
    </g>
  )
}

// Dark mode, woken by a click: a cross-shaped anger mark where the Zs were.
function AngerMark({ x, y, size }: { x: number; y: number; size: number }) {
  const a = size * 0.15
  const b = size * 0.5
  const arcs = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]
    .map(
      ([sx, sy]) =>
        `M ${sx * a} ${sy * b} Q ${sx * a} ${sy * a} ${sx * b} ${sy * a}`
    )
    .join(" ")
  return (
    <g
      className="hidden dark:block"
      transform={`translate(${x} ${y})`}
      aria-hidden
    >
      <path
        className="mascot-anger"
        d={arcs}
        fill="none"
        stroke={ANGER}
        strokeWidth={size * 0.2}
        strokeLinecap="round"
      />
    </g>
  )
}

type Expression = "idle" | "think" | "happy" | "wink"

// Clicking a character in light mode steps to its next expression.
const EXPRESSIONS: Expression[] = ["idle", "think", "happy", "wink"]

type Eyes = Expression | "closed" | "dizzy" | "angry"
type NodeKind = "push" | "body" | "eye" | "shadow"

// Placement of each 240-unit character box inside the viewBox.
const CHARS = [
  // Blip
  {
    tx: 0,
    ty: 44,
    scale: 1.3,
    cx: 156,
    cy: 200,
    half: 89.7,
    minX: -30,
    maxX: Infinity,
  },
  // Pebble
  {
    tx: 240,
    ty: 96,
    scale: 1.05,
    cx: 366,
    cy: 222,
    half: 64,
    minX: -Infinity,
    maxX: 40,
  },
] as const
const FLOOR_Y = 284
// Gap between Blip's right edge and Pebble's left edge at rest.
const REST_GAP = CHARS[1].cx - CHARS[1].half - (CHARS[0].cx + CHARS[0].half)

const MAX_EYE_SHIFT = 6
const MAX_LEAN = 5

interface Sim {
  x: number
  vx: number
  y: number
  vy: number
  lean: number
  vlean: number
  ex: number
  vex: number
  ey: number
  vey: number
  squash: number
  vsquash: number
}

const newSim = (): Sim => ({
  x: 0,
  vx: 0,
  y: 0,
  vy: 0,
  lean: 0,
  vlean: 0,
  ex: 0,
  vex: 0,
  ey: 0,
  vey: 0,
  squash: 0,
  vsquash: 0,
})

type Pair<K extends keyof Sim> = K extends `v${string}` ? never : K

// Semi-implicit Euler step of a damped spring pulling `key` towards target.
function spring<K extends keyof Sim>(
  s: Sim,
  key: Pair<K>,
  target: number,
  stiffness: number,
  damping: number,
  dt: number
) {
  const vKey = `v${key}` as keyof Sim
  s[vKey] += (stiffness * (target - s[key]) - damping * s[vKey]) * dt
  s[key] += s[vKey] * dt
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v))

function useBlink() {
  const [blinking, setBlinking] = useState(false)
  useEffect(() => {
    let t1: ReturnType<typeof setTimeout>
    let t2: ReturnType<typeof setTimeout>
    const schedule = () => {
      t1 = setTimeout(
        () => {
          setBlinking(true)
          t2 = setTimeout(() => {
            setBlinking(false)
            schedule()
          }, 140)
        },
        Math.random() * 4000 + 2500
      )
    }
    schedule()
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])
  return blinking
}

function Blink({
  blinking,
  children,
}: {
  blinking: boolean
  children: ReactNode
}) {
  return (
    <g
      style={{
        transform: `scaleY(${blinking ? 0.1 : 1})`,
        transformBox: "fill-box",
        transformOrigin: "center",
        transition: "transform 0.08s ease-in-out",
      }}
    >
      {children}
    </g>
  )
}

const ARC = {
  fill: "none",
  stroke: "var(--eye)",
  strokeWidth: 5.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const

const BLIP_EYES: Record<Eyes, ReactNode> = {
  idle: (
    <g fill="var(--eye)">
      <rect x="86" y="103" width="16" height="22" rx="6" />
      <rect x="138" y="103" width="16" height="22" rx="6" />
    </g>
  ),
  think: (
    <g fill="var(--eye)">
      <rect x="84" y="111" width="20" height="8" rx="4" />
      <rect x="137" y="103" width="18" height="18" rx="6" />
    </g>
  ),
  happy: (
    <g {...ARC}>
      <path d="M 85 118 Q 94 105 103 118" />
      <path d="M 137 118 Q 146 105 155 118" />
    </g>
  ),
  wink: (
    <g {...ARC}>
      <polyline points="87,106 99,114 87,122" />
      <polyline points="153,106 141,114 153,122" />
    </g>
  ),
  closed: (
    <g fill="var(--eye)">
      <rect x="84" y="112" width="20" height="6" rx="3" />
      <rect x="136" y="112" width="20" height="6" rx="3" />
    </g>
  ),
  dizzy: (
    <g {...ARC}>
      <polyline points="87,106 99,114 87,122" />
      <polyline points="153,106 141,114 153,122" />
    </g>
  ),
  angry: (
    <g
      fill="var(--eye)"
      stroke="var(--eye)"
      strokeWidth="3"
      strokeLinejoin="round"
    >
      <polygon points="87,105 102,113 102,124 87,124" />
      <polygon points="138,113 153,105 153,124 138,124" />
    </g>
  ),
}

const PEBBLE_EYES: Record<Eyes, ReactNode> = {
  idle: (
    <g fill="var(--eye)">
      <rect x="91" y="102" width="14" height="18" rx="7" />
      <rect x="135" y="102" width="14" height="18" rx="7" />
    </g>
  ),
  think: (
    <g fill="var(--eye)">
      <rect x="88" y="109" width="18" height="7" rx="3.5" />
      <rect x="135" y="103" width="15" height="15" rx="6" />
    </g>
  ),
  happy: (
    <g {...ARC}>
      <path d="M 89 114 Q 98 101 107 114" />
      <path d="M 133 114 Q 142 101 151 114" />
    </g>
  ),
  wink: (
    <g {...ARC} strokeWidth={5}>
      <polyline points="89,104 103,111 89,118" />
      <polyline points="151,104 137,111 151,118" />
    </g>
  ),
  closed: (
    <g fill="var(--eye)">
      <rect x="88" y="108" width="18" height="6" rx="3" />
      <rect x="134" y="108" width="18" height="6" rx="3" />
    </g>
  ),
  dizzy: (
    <g {...ARC} strokeWidth={5}>
      <polyline points="91,104 103,111 91,118" />
      <polyline points="149,104 137,111 149,118" />
    </g>
  ),
  angry: (
    <g
      fill="var(--eye)"
      stroke="var(--eye)"
      strokeWidth="3"
      strokeLinejoin="round"
    >
      <polygon points="92,104 104,110 104,119 92,119" />
      <polygon points="136,110 148,104 148,119 136,119" />
    </g>
  ),
}

interface CharacterProps {
  eyes: Eyes
  blinking: boolean
  index: number
}

function Blip({ eyes, blinking, index }: CharacterProps) {
  const angry = eyes === "angry"
  return (
    <g data-node={`body-${index}`}>
      <g className={angry ? "mascot-float mascot-glitch" : "mascot-float"}>
        <g>
          <g transform="translate(15, -12)" opacity="0.22">
            <path
              d={BLIP_BODY}
              fill="var(--echo-far)"
              stroke="var(--echo-far)"
              strokeWidth="18"
              strokeLinejoin="round"
            />
          </g>
          <g transform="translate(7.5, -6)" opacity="0.45">
            <path
              d={BLIP_BODY}
              fill={ECHO_GREY}
              stroke={ECHO_GREY}
              strokeWidth="18"
              strokeLinejoin="round"
            />
          </g>
          <path
            d={BLIP_BODY}
            fill="var(--ink)"
            stroke="var(--ink)"
            strokeWidth="18"
            strokeLinejoin="round"
          />
          <g fill="none" stroke="var(--crease)" strokeLinecap="round">
            {/* Dark mode keeps only the belly crease, slightly heavier. */}
            <g className="dark:hidden">
              <path d="M 76 73 Q 86 68 95 73" strokeWidth="3.5" />
              <path d="M 76 135 Q 84 141 92 137" strokeWidth="4" />
              <path d="M 148 137 Q 156 141 164 135" strokeWidth="4" />
            </g>
            <path
              d={
                angry
                  ? "M 106 152 Q 120 142 134 152"
                  : "M 104 144 Q 120 155 136 144"
              }
              strokeWidth="4.5"
              className="dark:[stroke-width:5]"
            />
          </g>
          <g data-node={`eye-${index}`}>
            <Blink blinking={blinking && eyes === "idle"}>
              {BLIP_EYES[eyes]}
            </Blink>
          </g>
        </g>
      </g>
      {angry ? (
        <AngerMark x={172} y={62} size={16} />
      ) : (
        <Snore x={176} y={56} size={12} />
      )}
    </g>
  )
}

function Pebble({ eyes, blinking, index }: CharacterProps) {
  const angry = eyes === "angry"
  return (
    <g data-node={`body-${index}`}>
      <g
        className={
          angry
            ? "mascot-float mascot-float-late mascot-glitch"
            : "mascot-float mascot-float-late"
        }
      >
        <g>
          <g
            transform="translate(9, -7)"
            strokeLinejoin="round"
            strokeLinecap="round"
          >
            <g opacity="0.22" fill="var(--echo-far)" stroke="var(--echo-far)">
              <path d={PEBBLE_SPROUT} strokeWidth="13" fill="none" />
              <path d={PEBBLE_BODY} strokeWidth="18" />
            </g>
          </g>
          <g
            fill="var(--ink)"
            stroke="var(--ink)"
            strokeLinejoin="round"
            strokeLinecap="round"
          >
            <path d={PEBBLE_SPROUT} strokeWidth="13" fill="none" />
            <path d={PEBBLE_BODY} strokeWidth="18" />
          </g>
          <g fill="none" stroke="var(--crease)" strokeLinecap="round">
            <path
              d="M 82 80 Q 96 73 110 78"
              strokeWidth="4"
              className="dark:hidden"
            />
            <path
              d={
                angry
                  ? "M 94 142 Q 120 132 146 142"
                  : "M 86 134 Q 120 148 154 134"
              }
              strokeWidth="4.5"
              className="dark:[stroke-width:5]"
            />
          </g>
          <g data-node={`eye-${index}`}>
            <Blink blinking={blinking && eyes === "idle"}>
              {PEBBLE_EYES[eyes]}
            </Blink>
          </g>
          <g fill="#FF7B72" opacity="0.85">
            <rect x="74" y="116" width="10" height="6" rx="3" />
            <rect x="156" y="116" width="10" height="6" rx="3" />
          </g>
        </g>
      </g>
      {angry ? (
        <AngerMark x={164} y={70} size={16} />
      ) : (
        <Snore x={166} y={62} size={13} />
      )}
    </g>
  )
}

export interface LoginMascotsProps {
  /** The username field is focused: the pair glance at each other. */
  isTyping?: boolean
  /** The password field is focused or filled: both close their eyes. */
  isPasswordActive?: boolean
}

export function LoginMascots({
  isTyping = false,
  isPasswordActive = false,
}: LoginMascotsProps) {
  // Dark mode: both are asleep — eyes shut, gently breathing, no interaction.
  const still = useTheme().theme === "dark"
  const svgRef = useRef<SVGSVGElement>(null)
  const blinking = [useBlink(), useBlink()]
  const [lookingAtEachOther, setLookingAtEachOther] = useState(false)
  const [hit, setHit] = useState([false, false])
  const [expressions, setExpressions] = useState<Expression[]>(["idle", "idle"])
  // Dark mode: a click wakes a sleeper up angry for 1.2s, then it dozes off.
  const [angry, setAngry] = useState([false, false])
  const angryTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const wake = (index: number) => {
    setAngry((a) => a.map((v, i) => (i === index ? true : v)))
    clearTimeout(angryTimers.current[index])
    angryTimers.current[index] = setTimeout(
      () => setAngry((a) => a.map((v, i) => (i === index ? false : v))),
      1200
    )
  }
  useEffect(() => {
    const timers = angryTimers.current
    return () => timers.forEach(clearTimeout)
  }, [])
  const modeRef = useRef({ password: false, looking: false })
  const pokeRef = useRef<(index: number, e: PointerEvent) => void>(() => {})

  useEffect(() => {
    if (!isTyping) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLookingAtEachOther(false)
      return
    }
    setLookingAtEachOther(true)
    const t = setTimeout(() => setLookingAtEachOther(false), 900)
    return () => clearTimeout(t)
  }, [isTyping])

  useEffect(() => {
    modeRef.current = {
      password: isPasswordActive,
      looking: lookingAtEachOther,
    }
  }, [isPasswordActive, lookingAtEachOther])

  useEffect(() => {
    const sims = [newSim(), newSim()]
    const hitTimers: ReturnType<typeof setTimeout>[] = []
    let pointer: { x: number; y: number } | null = null
    let frame = 0
    let last = performance.now()

    const toViewBox = (clientX: number, clientY: number) => {
      const ctm = svgRef.current?.getScreenCTM()
      if (!ctm) return null
      const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse())
      return { x: p.x, y: p.y }
    }

    const showHit = (index: number) => {
      setHit((h) => h.map((v, i) => (i === index ? true : v)))
      clearTimeout(hitTimers[index])
      hitTimers[index] = setTimeout(
        () => setHit((h) => h.map((v, i) => (i === index ? false : v))),
        650
      )
    }

    // Writes the simulated pose to nodes tagged data-node="kind-index".
    const paint = () => {
      const svg = svgRef.current
      if (!svg) return
      const node = (kind: NodeKind, i: number) =>
        svg.querySelector<SVGGElement>(`[data-node="${kind}-${i}"]`)
      sims.forEach((s, i) => {
        const c = CHARS[i]
        const sx = 1 + 0.14 * s.squash
        const sy = 1 - 0.14 * s.squash
        node("push", i)?.setAttribute(
          "transform",
          `translate(${s.x.toFixed(2)} ${s.y.toFixed(2)})`
        )
        node("body", i)?.setAttribute(
          "transform",
          `rotate(${s.lean.toFixed(2)} 120 179) translate(120 179) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(-120 -179)`
        )
        node("eye", i)?.setAttribute(
          "transform",
          `translate(${s.ex.toFixed(2)} ${s.ey.toFixed(2)})`
        )
        const shrink = clamp(1 + s.y / 120, 0.5, 1)
        node("shadow", i)?.setAttribute(
          "transform",
          `translate(${(c.cx + s.x).toFixed(2)} ${FLOOR_Y}) scale(${shrink.toFixed(3)})`
        )
      })
    }

    if (still) {
      pokeRef.current = () => {}
      paint()
      return () => hitTimers.forEach(clearTimeout)
    }

    // Click: squash, hop and slide away from the pointer.
    pokeRef.current = (index, e) => {
      const p = toViewBox(e.clientX, e.clientY)
      const s = sims[index]
      const c = CHARS[index]
      const dx = p ? c.cx + s.x - p.x : 0
      const dir = Math.abs(dx) < 4 ? (index === 0 ? -1 : 1) : Math.sign(dx)
      s.vx += dir * 520
      s.vy -= 240
      s.squash = 1
      s.vsquash = 0
      setExpressions((list) =>
        list.map((e, i) =>
          i === index
            ? EXPRESSIONS[(EXPRESSIONS.indexOf(e) + 1) % EXPRESSIONS.length]
            : e
        )
      )
    }

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      const mode = modeRef.current
      const p = pointer ? toViewBox(pointer.x, pointer.y) : null

      sims.forEach((s, i) => {
        const c = CHARS[i]
        let ex = 0
        let ey = 0
        let lean = 0
        if (mode.password) {
          ex = -4
          ey = -2
          lean = -2
        } else if (mode.looking) {
          ex = i === 0 ? 6 : -6
          ey = 1
          lean = i === 0 ? 2 : -2
        } else if (p) {
          const dx = p.x - (c.cx + s.x)
          const dy = p.y - (c.cy + s.y - 20)
          const dist = Math.hypot(dx, dy) || 1
          const reach = Math.min(dist / 140, 1) * MAX_EYE_SHIFT
          ex = (dx / dist) * reach
          ey = (dy / dist) * reach * 0.7
          lean = clamp(dx / 40, -MAX_LEAN, MAX_LEAN)
        }
        // Sliding drags the body back like inertia.
        lean -= clamp(s.vx * 0.02, -10, 10)

        spring(s, "ex", ex, 900, 45, dt)
        spring(s, "ey", ey, 900, 45, dt)
        spring(s, "lean", lean, 260, 20, dt)
        spring(s, "x", 0, 40, 9, dt)
        spring(s, "y", 0, 220, 12, dt)
        spring(s, "squash", 0, 520, 14, dt)

        // Floor and side walls.
        if (s.y > 0) {
          s.y = 0
          s.vy = -s.vy * 0.3
        }
        if (s.x < c.minX) {
          s.x = c.minX
          s.vx = Math.abs(s.vx) * 0.4
        } else if (s.x > c.maxX) {
          s.x = c.maxX
          s.vx = -Math.abs(s.vx) * 0.4
        }
      })

      // Pushing one into the other shoves it along.
      const [a, b] = sims
      const overlap = a.x - b.x - REST_GAP
      if (overlap > 0) {
        a.x -= overlap / 2
        b.x += overlap / 2
        const rel = a.vx - b.vx
        if (rel > 0) {
          // Whoever was moving faster towards the other is the one doing the shoving.
          const struck = a.vx > -b.vx ? 1 : 0
          a.vx -= rel * 0.75
          b.vx += rel * 0.75
          if (rel > 160) {
            const t = sims[struck]
            t.vy -= rel * 0.25
            t.squash = Math.max(t.squash, 0.6)
            showHit(struck)
          }
        }
        // Keep both inside the walls after separating them.
        a.x = clamp(a.x, CHARS[0].minX, CHARS[0].maxX)
        b.x = clamp(b.x, CHARS[1].minX, CHARS[1].maxX)
      }

      paint()
    }

    const onMove = (e: globalThis.PointerEvent) => {
      pointer = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener("pointermove", onMove)
    frame = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener("pointermove", onMove)
      cancelAnimationFrame(frame)
      hitTimers.forEach(clearTimeout)
    }
  }, [still])

  const eyesFor = (i: number): Eyes =>
    still
      ? angry[i]
        ? "angry"
        : "closed"
      : isPasswordActive
        ? "closed"
        : hit[i]
          ? "dizzy"
          : expressions[i]

  return (
    <svg
      ref={svgRef}
      viewBox="28 80 450 220"
      className="w-full max-w-[560px] overflow-visible select-none [--crease:#EAEAEA] [--echo-far:#080808] [--eye:#FFFFFF] [--ink:#080808] dark:[--crease:#252529] dark:[--echo-far:#99999E] dark:[--eye:#161618] dark:[--ink:#EAEAEA]"
      role="img"
      aria-label="MLTVRS 吉祥物 Blip 与 Pebble"
    >
      <style>{`
        @keyframes mascot-float {
          0%, 100% { transform: translateY(2.5px); }
          50% { transform: translateY(-2.5px); }
        }
        .mascot-float { animation: mascot-float 3s ease-in-out infinite; }
        .mascot-float-late { animation-duration: 3.2s; animation-delay: -1.4s; }
        @keyframes mascot-breathe {
          0%, 100% { transform: scale(1, 1); }
          50% { transform: scale(1.012, 1.03); }
        }
        .dark .mascot-float {
          animation: mascot-breathe 4.2s ease-in-out infinite;
          transform-origin: 120px 179px;
        }
        .dark .mascot-float-late { animation-duration: 4.6s; animation-delay: -2s; }
        @keyframes mascot-snore {
          0% { transform: translate(0, 0) scale(0.5); opacity: 0; }
          20% { opacity: 0.75; }
          75% { opacity: 0.6; }
          100% { transform: translate(20px, -30px) scale(1.15); opacity: 0; }
        }
        .mascot-snore {
          animation: mascot-snore 3.3s ease-out infinite;
          transform-box: fill-box;
          transform-origin: center;
          opacity: 0;
        }
        /* "跃迁" glitch jump from blip.html, used when a sleeper is woken. */
        @keyframes mascot-glitch {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(-4px, 2px); }
          50% { transform: translate(4px, -2px); }
          75% { transform: translate(-2px, -2px); }
        }
        .dark .mascot-float.mascot-glitch {
          animation: mascot-glitch 0.5s steps(2) infinite;
        }
        @keyframes mascot-anger {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.25); }
        }
        .mascot-anger {
          animation: mascot-anger 0.6s ease-in-out infinite;
          transform-box: fill-box;
          transform-origin: center;
        }
        @media (prefers-reduced-motion: reduce) {
          .mascot-float, .dark .mascot-float, .dark .mascot-float.mascot-glitch,
          .mascot-anger { animation: none; }
          .mascot-snore {
            animation: none;
            opacity: 0.7;
            transform: translate(var(--zx), var(--zy)) scale(var(--zs));
          }
        }
      `}</style>

      <g fill="var(--ink)" opacity="0.06">
        <g
          data-node="shadow-0"
          transform={`translate(${CHARS[0].cx} ${FLOOR_Y})`}
        >
          <ellipse rx="78" ry="7" />
        </g>
        <g
          data-node="shadow-1"
          transform={`translate(${CHARS[1].cx} ${FLOOR_Y})`}
        >
          <ellipse rx="58" ry="6" />
        </g>
      </g>

      {CHARS.map((c, i) => {
        const Character = i === 0 ? Blip : Pebble
        return (
          <g
            key={i}
            data-node={`push-${i}`}
            className="cursor-pointer touch-manipulation"
            onPointerDown={(e) => (still ? wake(i) : pokeRef.current(i, e))}
          >
            <g transform={`translate(${c.tx}, ${c.ty}) scale(${c.scale})`}>
              <Character eyes={eyesFor(i)} blinking={blinking[i]} index={i} />
            </g>
          </g>
        )
      })}
    </svg>
  )
}
