import * as React from "react"
import { flushSync } from "react-dom"

type Theme = "dark" | "light"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)"
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

const ThemeProviderContext = React.createContext<
  ThemeProviderState | undefined
>(undefined)

/** The theme currently on <html> (the class is the applied state). */
function appliedTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

function applyThemeClass(theme: Theme) {
  const root = document.documentElement
  if (root.classList.contains(theme)) return
  root.classList.remove("light", "dark")
  root.classList.add(theme)
}

/**
 * Switch with a cross-fade. The browser snapshots the old page and fades it
 * into the new one on the compositor (View Transitions, 240ms in
 * styles/motion.css), so the switch costs a single style recalculation.
 * Animating colours per element instead meant transitions on every node:
 * each frame restyled and repainted the whole page, and the switch stalled.
 *
 * While switching, `.theme-switching` also turns off the components' own
 * colour transitions (hover fades on buttons, rows, badges…). Otherwise every
 * one of them would start animating towards the new palette and restyle the
 * page each frame of the fade. They come back once the fade has finished,
 * when no colour changes any more, so nothing animates.
 */
function switchTheme(commit: () => void) {
  const root = document.documentElement
  const begin = () => {
    root.classList.add("theme-switching")
    commit()
  }
  const end = () => root.classList.remove("theme-switching")

  if (
    typeof document.startViewTransition !== "function" ||
    window.matchMedia(REDUCED_MOTION_QUERY).matches
  ) {
    begin()
    // Two frames: the new colours are applied before transitions return.
    requestAnimationFrame(() => requestAnimationFrame(end))
    return
  }
  document.startViewTransition(begin).finished.finally(end)
}

function isTheme(value: string | null): value is Theme {
  return value === "dark" || value === "light"
}

/** First visit (or a legacy "system" value): start from the OS preference once. */
function initialTheme(storageKey: string, fallback?: Theme): Theme {
  const stored = localStorage.getItem(storageKey)
  if (isTheme(stored)) return stored
  if (fallback) return fallback
  return window.matchMedia(COLOR_SCHEME_QUERY).matches ? "dark" : "light"
}

export function ThemeProvider({
  children,
  defaultTheme,
  storageKey = "theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(() =>
    initialTheme(storageKey, defaultTheme)
  )
  const setTheme = React.useCallback(
    (nextTheme: Theme) => {
      localStorage.setItem(storageKey, nextTheme)
      if (appliedTheme() === nextTheme) return
      switchTheme(() => {
        // Inside the transition callback: the DOM must reach the new state
        // before the browser takes the "after" snapshot.
        flushSync(() => setThemeState(nextTheme))
        applyThemeClass(nextTheme)
      })
    },
    [storageKey]
  )

  const toggleTheme = React.useCallback(() => {
    setTheme(appliedTheme() === "dark" ? "light" : "dark")
  }, [setTheme])

  // Initial paint and changes from other tabs: applied without animation.
  React.useEffect(() => {
    applyThemeClass(theme)
  }, [theme])

  // Keep tabs in sync.
  React.useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || event.key !== storageKey) {
        return
      }
      if (isTheme(event.newValue)) setThemeState(event.newValue)
    }

    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [storageKey])

  const value = React.useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  )

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = React.useContext(ThemeProviderContext)

  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }

  return context
}
