import { useEffect, useRef, useState, type RefObject } from "react"

// Tracks the pointer and returns the offset (clamped to maxDistance) from the
// centre of `ref`'s element. Computed in the event handler so render stays pure.
function usePointerOffset(
  ref: RefObject<HTMLDivElement | null>,
  maxDistance: number,
  disabled: boolean
) {
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (disabled) return
    const onMove = (e: MouseEvent) => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const dx = e.clientX - (rect.left + rect.width / 2)
      const dy = e.clientY - (rect.top + rect.height / 2)
      const distance = Math.min(Math.hypot(dx, dy), maxDistance)
      const angle = Math.atan2(dy, dx)
      setOffset({
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
      })
    }
    window.addEventListener("mousemove", onMove)
    return () => window.removeEventListener("mousemove", onMove)
  }, [ref, maxDistance, disabled])

  return offset
}

interface LookProps {
  maxDistance?: number
  forceLookX?: number
  forceLookY?: number
}

function Pupil({
  size = 12,
  maxDistance = 5,
  pupilColor = "#2D2D2D",
  forceLookX,
  forceLookY,
}: LookProps & { size?: number; pupilColor?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const forced = forceLookX !== undefined && forceLookY !== undefined
  const tracked = usePointerOffset(ref, maxDistance, forced)
  const pos = forced ? { x: forceLookX, y: forceLookY } : tracked

  return (
    <div
      ref={ref}
      className="rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: pupilColor,
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        transition: "transform 0.1s ease-out",
      }}
    />
  )
}

function EyeBall({
  size = 18,
  pupilSize = 7,
  maxDistance = 5,
  isBlinking = false,
  forceLookX,
  forceLookY,
}: LookProps & { size?: number; pupilSize?: number; isBlinking?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const forced = forceLookX !== undefined && forceLookY !== undefined
  const tracked = usePointerOffset(ref, maxDistance, forced)
  const pos = forced ? { x: forceLookX, y: forceLookY } : tracked

  return (
    <div
      ref={ref}
      className="flex items-center justify-center overflow-hidden rounded-full bg-white transition-all duration-150"
      style={{ width: size, height: isBlinking ? 2 : size }}
    >
      {!isBlinking && (
        <div
          className="rounded-full"
          style={{
            width: pupilSize,
            height: pupilSize,
            backgroundColor: "#2D2D2D",
            transform: `translate(${pos.x}px, ${pos.y}px)`,
            transition: "transform 0.1s ease-out",
          }}
        />
      )}
    </div>
  )
}

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
          }, 150)
        },
        Math.random() * 4000 + 3000
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

interface Skew {
  faceX: number
  faceY: number
  bodySkew: number
}

// Face/body offsets relative to the pointer. Updated from the mouse handler.
function useBodyTracking(refs: RefObject<HTMLDivElement | null>[]) {
  const [state, setState] = useState<Skew[]>(() =>
    refs.map(() => ({ faceX: 0, faceY: 0, bodySkew: 0 }))
  )
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setState(
        refs.map((ref) => {
          const el = ref.current
          if (!el) return { faceX: 0, faceY: 0, bodySkew: 0 }
          const rect = el.getBoundingClientRect()
          const dx = e.clientX - (rect.left + rect.width / 2)
          const dy = e.clientY - (rect.top + rect.height / 3)
          return {
            faceX: Math.max(-15, Math.min(15, dx / 20)),
            faceY: Math.max(-10, Math.min(10, dy / 30)),
            bodySkew: Math.max(-6, Math.min(6, -dx / 120)),
          }
        })
      )
    }
    window.addEventListener("mousemove", onMove)
    return () => window.removeEventListener("mousemove", onMove)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return state
}

export interface AnimatedCharactersProps {
  /** A form field is focused: characters glance at each other. */
  isTyping?: boolean
  /** Number of characters currently in the password field. */
  passwordLength?: number
  /** Password is shown in plain text. */
  showPassword?: boolean
}

export function AnimatedCharacters({
  isTyping = false,
  passwordLength = 0,
  showPassword = false,
}: AnimatedCharactersProps) {
  const purpleRef = useRef<HTMLDivElement>(null)
  const blackRef = useRef<HTMLDivElement>(null)
  const yellowRef = useRef<HTMLDivElement>(null)
  const orangeRef = useRef<HTMLDivElement>(null)
  const [purplePos, blackPos, yellowPos, orangePos] = useBodyTracking([
    purpleRef,
    blackRef,
    yellowRef,
    orangeRef,
  ])

  const purpleBlinking = useBlink()
  const blackBlinking = useBlink()
  const [lookingAtEachOther, setLookingAtEachOther] = useState(false)
  const [peeking, setPeeking] = useState(false)

  const hasPassword = passwordLength > 0
  const revealed = hasPassword && showPassword
  const hidden = hasPassword && !showPassword

  useEffect(() => {
    if (!isTyping) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLookingAtEachOther(false)
      return
    }
    setLookingAtEachOther(true)
    const t = setTimeout(() => setLookingAtEachOther(false), 800)
    return () => clearTimeout(t)
  }, [isTyping])

  useEffect(() => {
    if (!revealed) return
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => {
      timer = setTimeout(
        () => {
          setPeeking(true)
          timer = setTimeout(() => {
            setPeeking(false)
            schedule()
          }, 800)
        },
        Math.random() * 3000 + 2000
      )
    }
    schedule()
    return () => {
      clearTimeout(timer)
      setPeeking(false)
    }
  }, [revealed])

  const purpleLookX = revealed
    ? peeking
      ? 4
      : -4
    : lookingAtEachOther
      ? 3
      : undefined
  const purpleLookY = revealed
    ? peeking
      ? 5
      : -4
    : lookingAtEachOther
      ? 4
      : undefined
  const blackLookX = revealed ? -4 : lookingAtEachOther ? 0 : undefined
  const blackLookY = revealed ? -4 : lookingAtEachOther ? -4 : undefined
  const pupilLookX = revealed ? -5 : undefined
  const pupilLookY = revealed ? -4 : undefined

  return (
    <div className="relative" style={{ width: 550, height: 400 }}>
      {/* Purple */}
      <div
        ref={purpleRef}
        className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{
          left: 70,
          width: 180,
          height: isTyping || hidden ? 440 : 400,
          backgroundColor: "#6C3FF5",
          borderRadius: "10px 10px 0 0",
          zIndex: 1,
          transform: revealed
            ? "skewX(0deg)"
            : isTyping || hidden
              ? `skewX(${purplePos.bodySkew - 12}deg) translateX(40px)`
              : `skewX(${purplePos.bodySkew}deg)`,
          transformOrigin: "bottom center",
        }}
      >
        <div
          className="absolute flex gap-8 transition-all duration-700 ease-in-out"
          style={{
            left: revealed
              ? 20
              : lookingAtEachOther
                ? 55
                : 45 + purplePos.faceX,
            top: revealed ? 35 : lookingAtEachOther ? 65 : 40 + purplePos.faceY,
          }}
        >
          {[0, 1].map((i) => (
            <EyeBall
              key={i}
              isBlinking={purpleBlinking}
              forceLookX={purpleLookX}
              forceLookY={purpleLookY}
            />
          ))}
        </div>
      </div>

      {/* Black */}
      <div
        ref={blackRef}
        className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{
          left: 240,
          width: 120,
          height: 310,
          backgroundColor: "#2D2D2D",
          borderRadius: "8px 8px 0 0",
          zIndex: 2,
          transform: revealed
            ? "skewX(0deg)"
            : lookingAtEachOther
              ? `skewX(${blackPos.bodySkew * 1.5 + 10}deg) translateX(20px)`
              : isTyping || hidden
                ? `skewX(${blackPos.bodySkew * 1.5}deg)`
                : `skewX(${blackPos.bodySkew}deg)`,
          transformOrigin: "bottom center",
        }}
      >
        <div
          className="absolute flex gap-6 transition-all duration-700 ease-in-out"
          style={{
            left: revealed ? 10 : lookingAtEachOther ? 32 : 26 + blackPos.faceX,
            top: revealed ? 28 : lookingAtEachOther ? 12 : 32 + blackPos.faceY,
          }}
        >
          {[0, 1].map((i) => (
            <EyeBall
              key={i}
              size={16}
              pupilSize={6}
              maxDistance={4}
              isBlinking={blackBlinking}
              forceLookX={blackLookX}
              forceLookY={blackLookY}
            />
          ))}
        </div>
      </div>

      {/* Orange */}
      <div
        ref={orangeRef}
        className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{
          left: 0,
          width: 240,
          height: 200,
          zIndex: 3,
          backgroundColor: "#FF9B6B",
          borderRadius: "120px 120px 0 0",
          transform: revealed
            ? "skewX(0deg)"
            : `skewX(${orangePos.bodySkew}deg)`,
          transformOrigin: "bottom center",
        }}
      >
        <div
          className="absolute flex gap-8 transition-all duration-200 ease-out"
          style={{
            left: revealed ? 50 : 82 + orangePos.faceX,
            top: revealed ? 85 : 90 + orangePos.faceY,
          }}
        >
          {[0, 1].map((i) => (
            <Pupil key={i} forceLookX={pupilLookX} forceLookY={pupilLookY} />
          ))}
        </div>
      </div>

      {/* Yellow */}
      <div
        ref={yellowRef}
        className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{
          left: 310,
          width: 140,
          height: 230,
          backgroundColor: "#E8D754",
          borderRadius: "70px 70px 0 0",
          zIndex: 4,
          transform: revealed
            ? "skewX(0deg)"
            : `skewX(${yellowPos.bodySkew}deg)`,
          transformOrigin: "bottom center",
        }}
      >
        <div
          className="absolute flex gap-6 transition-all duration-200 ease-out"
          style={{
            left: revealed ? 20 : 52 + yellowPos.faceX,
            top: revealed ? 35 : 40 + yellowPos.faceY,
          }}
        >
          {[0, 1].map((i) => (
            <Pupil key={i} forceLookX={pupilLookX} forceLookY={pupilLookY} />
          ))}
        </div>
        <div
          className="absolute h-[4px] w-20 rounded-full bg-[#2D2D2D] transition-all duration-200 ease-out"
          style={{
            left: revealed ? 10 : 40 + yellowPos.faceX,
            top: 88 + (revealed ? 0 : yellowPos.faceY),
          }}
        />
      </div>
    </div>
  )
}

export const Component = AnimatedCharacters
