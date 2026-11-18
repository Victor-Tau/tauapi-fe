import type { ReactNode } from "react"

import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * KPI card (demo.html `.stat-card`): figure first, unit as a quiet tag,
 * label underneath. Flat, no decorative icon, not clickable (so no lift).
 */
export function StatCard({
  label,
  value,
  unit,
  loading = false,
  action,
}: {
  label: ReactNode
  value: ReactNode
  unit?: ReactNode
  loading?: boolean
  action?: ReactNode
}) {
  return (
    <Card className="justify-between gap-2 px-5 py-5">
      <div className="flex min-h-9 items-center gap-2">
        {loading ? (
          <Skeleton className="h-8 w-32 rounded-lg bg-sk-strong" />
        ) : (
          <span className="min-w-0 truncate text-2xl leading-normal font-semibold tracking-[-0.3px] tabular-nums">
            {value}
          </span>
        )}
        {/* Demo: the unit tag sits at the far end of the figure row. */}
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {unit && !loading && (
            <span className="rounded-md bg-nav-active px-2.5 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
              {unit}
            </span>
          )}
          {action}
        </span>
      </div>
      <div className="flex min-h-6 items-center text-sm text-muted-foreground">
        {label}
      </div>
    </Card>
  )
}

const ICON_TONE = {
  mint: "bg-success/10 text-success-text",
  amber: "bg-warning/12 text-warning-text",
  blue: "bg-info-text/10 text-info-text",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
} as const

/**
 * KPI card with a tinted icon tile: label, figure, then a one-line caption
 * (e.g. the input/output split under a token total).
 */
export function IconStatCard({
  icon: Icon,
  tone,
  label,
  value,
  caption,
  loading = false,
}: {
  icon: React.ComponentType<{ className?: string }>
  tone: keyof typeof ICON_TONE
  label: string
  value: ReactNode
  caption?: ReactNode
  loading?: boolean
}) {
  return (
    <Card className="flex-row items-start gap-4 px-5 py-5">
      <span
        aria-hidden="true"
        className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${ICON_TONE[tone]}`}
      >
        <Icon className="size-5" />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-medium text-foreground/80">{label}</span>
        {loading ? (
          <Skeleton className="my-0.5 h-7 w-28 rounded-lg bg-sk-strong" />
        ) : (
          <span className="truncate font-mono text-2xl leading-tight font-bold tracking-[-0.3px] tabular-nums">
            {value}
          </span>
        )}
        {caption && !loading && (
          <span className="truncate text-sm text-muted-foreground tabular-nums">
            {caption}
          </span>
        )}
      </div>
    </Card>
  )
}
