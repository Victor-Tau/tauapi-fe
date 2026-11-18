import { CheckIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Cross that turns into a check. Like the theme switch, the wrapper spins on
 * a spring while the two icons cross-fade inside it.
 */
export function RuleIcon({ met }: { met: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex size-3.5 shrink-0 transition-[rotate,scale] duration-[360ms] ease-(--ease-spring-pop) motion-reduce:transition-none",
        met && "rotate-[360deg]"
      )}
    >
      <XIcon
        className={cn(
          "absolute inset-0 size-3.5 transition-[opacity,scale] duration-200",
          met ? "scale-50 opacity-0" : "opacity-100"
        )}
      />
      <CheckIcon
        className={cn(
          "absolute inset-0 size-3.5 transition-[opacity,scale] duration-200",
          met ? "opacity-100" : "scale-50 opacity-0"
        )}
      />
    </span>
  )
}
