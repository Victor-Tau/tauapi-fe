import { useState } from "react"

/**
 * Key for re-mounting content with the `.swap-in` entrance only once the new
 * content is actually on screen. With `keepPreviousData` the old page stays
 * visible while the next one loads: the key follows `key` only when
 * `settled` (i.e. not placeholder data), so the animation plays on arrival,
 * not on click — and background refetches of the same page stay still.
 */
export function useSettledKey(key: string | number, settled: boolean) {
  const [shown, setShown] = useState(key)
  if (settled && shown !== key) setShown(key)
  return shown
}
