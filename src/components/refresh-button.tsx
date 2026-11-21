import { CheckIcon, RotateCwIcon } from "lucide-react"
import { useEffect, useRef, type ComponentProps } from "react"

import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { useFlash } from "@/hooks/use-flash"

/**
 * Page-level refresh: spins while fetching, then confirms with a check and
 * “已更新” for a moment — only when the user started the refresh, so
 * background refetches stay silent.
 */
export function RefreshButton({
  fetching,
  onRefresh,
  label = "刷新",
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, "onClick" | "children" | "disabled"> & {
  fetching: boolean
  onRefresh: () => void
  label?: string
}) {
  const [done, flash] = useFlash(1600)
  const requested = useRef(false)

  useEffect(() => {
    if (!fetching && requested.current) {
      requested.current = false
      flash()
    }
  }, [fetching, flash])

  return (
    <Button
      variant="outline"
      {...props}
      disabled={fetching}
      aria-busy={fetching || undefined}
      className={cn("min-w-0", className)}
      onClick={() => {
        requested.current = true
        onRefresh()
      }}
    >
      {done && !fetching ? (
        <CheckIcon
          data-icon="inline-start"
          className="animate-[icon-confirm-pop_400ms_var(--ease-spring-pop)] motion-reduce:animate-none"
        />
      ) : (
        <RotateCwIcon
          data-icon="inline-start"
          className={fetching ? "animate-spin" : undefined}
        />
      )}
      <span aria-live="polite">
        {fetching ? "更新中…" : done ? "已更新" : label}
      </span>
    </Button>
  )
}
