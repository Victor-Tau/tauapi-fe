import { useEffect, useRef, useState } from "react"
import { MoonIcon, SunIcon } from "lucide-react"

import { useTheme } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

/** Icon spin length (demo: 360ms spring). */
const SPIN_MS = 360

/**
 * Round light/dark switch (demo.html `.icon-circle`). One click toggles; the
 * icon spins on a spring while the surfaces cross-fade.
 */
export function ModeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()
  const [spinning, setSpinning] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  function toggle() {
    toggleTheme()
    setSpinning(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setSpinning(false), SPIN_MS)
  }

  const dark = theme === "dark"
  const Icon = dark ? SunIcon : MoonIcon

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "切换到浅色模式" : "切换到深色模式"}
      title={dark ? "切换到浅色模式" : "切换到深色模式"}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-foreground outline-none",
        "transition-[background-color,color,scale,translate] duration-[240ms,200ms,160ms,160ms] ease-[ease-out,ease-out,var(--ease-spring-pop),var(--ease-spring-pop)]",
        "hover:-translate-y-px hover:bg-nav-active active:translate-y-0 active:scale-92",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
    >
      {/* The wrapper persists across the icon swap so the spin animates. */}
      <span
        aria-hidden="true"
        className={cn(
          "theme-toggle-icon flex transition-transform duration-[360ms] ease-(--ease-spring-pop)",
          spinning && "rotate-180 scale-115"
        )}
      >
        <Icon className="size-4" />
      </span>
    </button>
  )
}
