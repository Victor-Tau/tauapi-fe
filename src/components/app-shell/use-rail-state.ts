import { useCallback, useEffect, useRef, useState } from "react"

import {
  RAIL_ENTER_DELAY,
  RAIL_LEAVE_DELAY,
  RAIL_SETTLE_TIME,
} from "@/components/app-shell/rail-context"
import { isKeyboardFocus } from "@/components/app-shell/input-modality"

/** Popups rendered in portals that count as "inside" the rail. */
const PORTAL_INSIDE = '[data-slot="dropdown-menu-content"]'

/**
 * Expansion state of the desktop rail, a React rewrite of demo.html's hover
 * debounce:
 * - mouse: expand 70ms after entering, collapse 180ms after leaving;
 * - keyboard: expand while focus-visible is inside, `Esc` collapses;
 * - pinned (Ctrl/⌘+B or the touch toggle): stays open until an outside press.
 * All timers are cleared on unmount.
 */
export function useRailState({
  pinned,
  unpin,
}: {
  pinned: boolean
  unpin: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [keyboard, setKeyboard] = useState(false)
  const [popupOpen, setPopupOpen] = useState(false)
  const enterTimer = useRef<number | undefined>(undefined)
  const leaveTimer = useRef<number | undefined>(undefined)
  const expandedAt = useRef(0)
  const railRef = useRef<HTMLElement>(null)

  const expanded = pinned || hovered || keyboard || popupOpen

  useEffect(() => {
    if (expanded) expandedAt.current = performance.now()
  }, [expanded])

  useEffect(
    () => () => {
      window.clearTimeout(enterTimer.current)
      window.clearTimeout(leaveTimer.current)
    },
    []
  )

  // A pinned rail closes on any press outside it (and outside its popups).
  useEffect(() => {
    if (!pinned) return undefined
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (!target || railRef.current?.contains(target)) return
      if (target.closest(`${PORTAL_INSIDE}, [data-slot="sidebar-trigger"]`)) {
        return
      }
      unpin()
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [pinned, unpin])

  const remainingSettle = useCallback(() => {
    const elapsed = performance.now() - expandedAt.current
    return Math.max(0, RAIL_SETTLE_TIME - elapsed)
  }, [])

  const onPointerEnter = useCallback((event: React.PointerEvent) => {
    if (event.pointerType !== "mouse") return
    window.clearTimeout(leaveTimer.current)
    window.clearTimeout(enterTimer.current)
    enterTimer.current = window.setTimeout(
      () => setHovered(true),
      RAIL_ENTER_DELAY
    )
  }, [])

  const onPointerLeave = useCallback((event: React.PointerEvent) => {
    if (event.pointerType !== "mouse") return
    window.clearTimeout(enterTimer.current)
    window.clearTimeout(leaveTimer.current)
    leaveTimer.current = window.setTimeout(
      () => setHovered(false),
      RAIL_LEAVE_DELAY
    )
  }, [])

  const onFocus = useCallback((event: React.FocusEvent) => {
    if (isKeyboardFocus(event.target as Element)) setKeyboard(true)
  }, [])

  const onBlur = useCallback((event: React.FocusEvent) => {
    const next = event.relatedTarget as Element | null
    if (next && railRef.current?.contains(next)) return
    if (next?.closest(PORTAL_INSIDE)) return
    setKeyboard(false)
  }, [])

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key !== "Escape") return
      // Escape inside a portalled menu belongs to the menu.
      if (!railRef.current?.contains(event.target as Node)) return
      setKeyboard(false)
      setHovered(false)
      if (pinned) unpin()
    },
    [pinned, unpin]
  )

  return {
    railRef,
    expanded,
    remainingSettle,
    setPopupOpen,
    handlers: { onPointerEnter, onPointerLeave, onFocus, onBlur, onKeyDown },
  }
}
