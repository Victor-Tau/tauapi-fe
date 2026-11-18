import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ACTIVITY_WEEKS,
  buildActivityGrid,
  type ActivityDay,
  type ActivityMode,
} from "@/utils/activity"
import { formatTokens } from "@/utils/format"

const MODES: { value: ActivityMode; label: string }[] = [
  { value: "daily", label: "每日" },
  { value: "weekly", label: "每周" },
  { value: "cumulative", label: "累计" },
]

const VALUE_LABEL: Record<ActivityMode, string> = {
  daily: "当日",
  weekly: "当周",
  cumulative: "累计",
}

const LEVEL_COLORS = [
  "var(--heat-0)",
  "var(--heat-1)",
  "var(--heat-2)",
  "var(--heat-3)",
  "var(--heat-4)",
] as const

const GRID_COLUMNS = {
  gridTemplateColumns: `repeat(${ACTIVITY_WEEKS}, minmax(0, 1fr))`,
}

const dateLabel = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
})

function formatDate(key: string) {
  return dateLabel.format(new Date(`${key}T00:00:00`))
}

interface Hover {
  day: ActivityDay
  /** The hovered cell, in viewport coordinates. */
  anchor: DOMRect
}

/** Gap between the card and the cell, and the minimum to the viewport edge. */
const OFFSET = 8
const EDGE = 8

export function ActivityHeatmap({
  tokens,
  loading,
}: {
  tokens: ReadonlyMap<string, number> | undefined
  loading: boolean
}) {
  const [mode, setMode] = useState<ActivityMode>("daily")
  const [hover, setHover] = useState<Hover | null>(null)
  const dismiss = useCallback(() => setHover(null), [])
  const grid = useMemo(
    () => (tokens ? buildActivityGrid(tokens, mode) : null),
    [tokens, mode]
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Token 活动</CardTitle>
        <CardAction>
          <ToggleGroup
            variant="outline"
            size="sm"
            spacing={0}
            value={[mode]}
            onValueChange={(value) => {
              const next = MODES.find((item) => item.value === value[0])
              if (next) setMode(next.value)
            }}
            aria-label="热力图口径"
          >
            {MODES.map((item) => (
              <ToggleGroupItem key={item.value} value={item.value}>
                {item.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {loading || !grid ? (
          <Skeleton className="h-44 w-full rounded-xl bg-sk-soft" />
        ) : (
          // Always fits the card: cells shrink on narrow screens rather
          // than the year scrolling sideways.
          <div onPointerLeave={dismiss}>
            <div>
              <div
                className="mb-2 grid text-[11px] text-muted-foreground sm:text-xs"
                style={GRID_COLUMNS}
                aria-hidden="true"
              >
                {grid.months.map((month, index) => (
                  <span
                    key={month.column}
                    // Labels overflow their (0-min) column instead of widening
                    // it; phones have room for every other month only.
                    className={
                      index % 2
                        ? "whitespace-nowrap max-sm:hidden"
                        : "whitespace-nowrap"
                    }
                    style={{
                      gridColumnStart: month.column + 1,
                      gridRowStart: 1,
                    }}
                  >
                    {month.label}
                  </span>
                ))}
              </div>
              <div
                className="grid grid-flow-col grid-rows-7 gap-0.5 sm:gap-[3px] lg:gap-1"
                style={GRID_COLUMNS}
                // The stats above summarise the grid for assistive tech.
                aria-hidden="true"
              >
                {grid.weeks.flatMap((week, column) =>
                  week.map((day, row) =>
                    day ? (
                      <div
                        key={day.date}
                        className="aspect-square rounded-[3px] transition-[box-shadow] hover:ring-2 hover:ring-foreground/25 sm:rounded-[4px]"
                        style={{ background: LEVEL_COLORS[day.level] }}
                        onPointerEnter={(event) =>
                          setHover({
                            day,
                            anchor: event.currentTarget.getBoundingClientRect(),
                          })
                        }
                      />
                    ) : (
                      // Later this week: keeps the column shape, draws nothing.
                      <div key={`${column}-${row}`} />
                    )
                  )
                )}
              </div>
              {hover && (
                <CellTooltip hover={hover} mode={mode} onDismiss={dismiss} />
              )}
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>统计数据定时汇总，最近的调用可能稍后计入。</span>
          <span className="flex items-center gap-1" aria-hidden="true">
            少
            {LEVEL_COLORS.map((color) => (
              <span
                key={color}
                className="size-3 rounded-[3px]"
                style={{ background: color }}
              />
            ))}
            多
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * The hover card lives in <body> with fixed positioning: inside the grid's
 * horizontal scroller it would be clipped at the edges and would widen the
 * scroll area (bringing up a scrollbar). It is measured, centred over the
 * cell, kept inside the viewport, and flipped below when there is no room
 * above.
 */
function CellTooltip({
  hover,
  mode,
  onDismiss,
}: {
  hover: Hover
  mode: ActivityMode
  onDismiss: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const card = ref.current
    if (!card) return
    const { anchor } = hover
    const { width, height } = card.getBoundingClientRect()
    const viewport = document.documentElement.clientWidth
    const left = Math.min(
      Math.max(anchor.left + anchor.width / 2 - width / 2, EDGE),
      viewport - width - EDGE
    )
    const above = anchor.top - OFFSET - height
    const top = above >= EDGE ? above : anchor.bottom + OFFSET
    card.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`
    card.style.visibility = "visible"
  }, [hover, mode])

  // The anchor rect goes stale once anything scrolls or resizes.
  useEffect(() => {
    window.addEventListener("scroll", onDismiss, {
      capture: true,
      passive: true,
    })
    window.addEventListener("resize", onDismiss)
    return () => {
      window.removeEventListener("scroll", onDismiss, { capture: true })
      window.removeEventListener("resize", onDismiss)
    }
  }, [onDismiss])

  return createPortal(
    <div
      ref={ref}
      // Hidden until measured and placed, so it never flashes at 0,0.
      style={{ visibility: "hidden" }}
      className="pointer-events-none fixed top-0 left-0 z-50 w-max rounded-xl bg-popover px-3 py-2 text-xs text-popover-foreground shadow-popover"
    >
      <div className="font-medium">{formatDate(hover.day.date)}</div>
      <div className="mt-1 flex flex-col gap-0.5 text-muted-foreground tabular-nums">
        <span>
          当日{" "}
          <span className="font-medium text-foreground">
            {formatTokens(hover.day.tokens)}
          </span>{" "}
          Token
        </span>
        {mode !== "daily" && (
          <span>
            {VALUE_LABEL[mode]}{" "}
            <span className="font-medium text-foreground">
              {formatTokens(hover.day.value)}
            </span>{" "}
            Token
          </span>
        )}
      </div>
    </div>,
    document.body
  )
}
