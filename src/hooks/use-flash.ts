import { useCallback, useEffect, useRef, useState } from "react"

/**
 * A short-lived "done" state for in-place confirmation (copied, refreshed…).
 * `flash()` turns it on and restarts the timer if it is already on.
 */
export function useFlash(duration = 1400) {
  const [on, setOn] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const flash = useCallback(() => {
    window.clearTimeout(timer.current)
    setOn(true)
    timer.current = window.setTimeout(() => setOn(false), duration)
  }, [duration])
  return [on, flash] as const
}
