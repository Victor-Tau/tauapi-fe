import { createContext, useContext } from "react"

/** Demo timings (ms). */
export const RAIL_ENTER_DELAY = 70
export const RAIL_LEAVE_DELAY = 180
export const RAIL_SETTLE_TIME = 220
export const POPOVER_DELAY = 45

export interface RailContextValue {
  /** Labels visible (desktop rail expanded, or the mobile sheet). */
  expanded: boolean
  /** Ms until the expand animation has settled (0 once settled). Call from handlers. */
  remainingSettle: () => number
  /** Lets popups that live in a portal keep the rail open while they are open. */
  setPopupOpen: (open: boolean) => void
}

export const RailContext = createContext<RailContextValue>({
  expanded: true,
  remainingSettle: () => 0,
  setPopupOpen: () => undefined,
})

export function useRail() {
  return useContext(RailContext)
}
