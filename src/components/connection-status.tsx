import { useEffect, useRef, useState } from "react"

import { useVersions } from "@/components/app-brand"
import { useSiteStatus } from "@/hooks/use-queries"
import { cn } from "@/lib/utils"
import { isKeyboardFocus } from "@/components/app-shell/input-modality"

export type ConnectionState = "loading" | "online" | "offline"

const DOT: Record<ConnectionState, string> = {
  online: "bg-status-ok shadow-[0_0_0_2px_var(--status-ok-glow)]",
  offline: "bg-status-err shadow-[0_0_0_2px_var(--status-err-glow)]",
  loading: "bg-(--status-idle) animate-pulse",
}

/** Inline status line (sign-in page, where it is task-critical information). */
export function ConnectionStatus({
  state,
  label,
  className,
}: {
  state: ConnectionState
  label: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-xs text-muted-foreground",
        state === "offline" && "text-destructive",
        className
      )}
      role="status"
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 shrink-0 rounded-full", DOT[state])}
      />
      {label}
    </span>
  )
}

const CORNER_TEXT: Record<ConnectionState, string> = {
  online: "后端服务器通讯正常",
  offline: "无法连接后端服务器",
  loading: "正在连接后端服务器",
}

/** Close delay after the pointer leaves the zone/card (demo: 65ms). */
const CLOSE_DELAY = 65

/**
 * Corner indicator (demo.html): a 6px dot in the top-right edge; hovering
 * (mouse), focusing (keyboard) or tapping it slides a status card out
 * diagonally. Reflects the last `/api/status` request, not a live heartbeat.
 */
export function ConnectionIndicator() {
  const site = useSiteStatus()
  const versions = useVersions()
  const state: ConnectionState = site.isSuccess
    ? "online"
    : site.isError
      ? "offline"
      : "loading"
  const [hoverOpen, setHoverOpen] = useState(false)
  const [focusOpen, setFocusOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const zoneRef = useRef<HTMLButtonElement>(null)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  // A tap-opened card closes on the next press anywhere else.
  useEffect(() => {
    if (!pinned) return undefined
    const onPointerDown = (event: PointerEvent) => {
      if (!zoneRef.current?.contains(event.target as Node)) setPinned(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [pinned])

  const open = hoverOpen || focusOpen || pinned
  const text = CORNER_TEXT[state]

  return (
    <>
      <button
        ref={zoneRef}
        type="button"
        className="status-zone"
        data-state={
          state === "online" ? "ok" : state === "offline" ? "error" : "loading"
        }
        data-open={open}
        aria-label={`后端连接状态：${text}；前端版本 ${versions.fe}，后端版本 ${versions.be}`}
        aria-expanded={open}
        onPointerEnter={(event) => {
          if (event.pointerType !== "mouse") return
          window.clearTimeout(timer.current)
          setHoverOpen(true)
        }}
        onPointerLeave={(event) => {
          if (event.pointerType !== "mouse") return
          window.clearTimeout(timer.current)
          timer.current = window.setTimeout(() => {
            setHoverOpen(false)
            setPinned(false)
          }, CLOSE_DELAY)
        }}
        onFocus={(event) => {
          if (isKeyboardFocus(event.currentTarget)) setFocusOpen(true)
        }}
        onBlur={() => {
          setFocusOpen(false)
          setPinned(false)
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setFocusOpen(false)
            setPinned(false)
          }
        }}
        onClick={() => setPinned((value) => !value)}
      >
        <span className="status-dot" aria-hidden="true" />
        <span className="status-card" aria-hidden="true">
          <span className="status-inner">
            <span className="status-row">
              <span className="status-badge-dot" />
              <span className="status-text">{text}</span>
            </span>
            <span className="status-versions">
              <span>
                <span className="status-version-key">fe</span>
                <span className="text-muted-foreground">:&nbsp;</span>
                <span className="status-version-value">{versions.fe}</span>
              </span>
              <span>
                <span className="status-version-key">be</span>
                <span className="text-muted-foreground">:&nbsp;</span>
                <span className="status-version-value">{versions.be}</span>
              </span>
            </span>
          </span>
        </span>
      </button>
      {/* Announce changes without needing to open the card. */}
      <span className="sr-only" role="status">
        {text}
      </span>
    </>
  )
}
