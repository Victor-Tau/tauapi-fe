import { useMemo } from "react"
import { ChartColumnIcon } from "lucide-react"
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts"

import type { TokenTrend, TokenTrendBucket, TrendUnit } from "@/api/usage"
import { useReducedMotion } from "@/components/app-shell/use-reduced-motion"
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { formatNumber, formatTokens } from "@/utils/format"

/** The three series, in the order of the summary strip and the tooltip. */
const SERIES = {
  input: { label: "输入", color: "var(--chart-input)" },
  output: { label: "输出", color: "var(--chart-output)" },
  cacheRead: { label: "缓存", color: "var(--chart-cache)" },
} as const

const chartConfig = SERIES satisfies ChartConfig

type Point = TokenTrendBucket & { label: string; title: string }

const hourLabel = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})
const dayLabel = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
})

/** "11-15" / "11-15 08:00" in the browser's timezone. */
function pointLabels(start: number, unit: TrendUnit) {
  const date = new Date(start * 1000)
  const day = dayLabel.format(date).replace("/", "-")
  if (unit === "day") return { label: day, title: day }
  const hour = hourLabel.format(date)
  return { label: hour, title: `${day} ${hour}` }
}

/** Axis ticks: "60M", "300K" — tooltip and summary carry the exact figures. */
const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
})

const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/** Share of input served from cache; undefined without input. */
function cacheHitRate(cacheRead: number, input: number): string {
  return input > 0 ? percent.format(cacheRead / input) : "—"
}

export function TokenTrendSummary({
  trend,
  loading,
}: {
  trend: TokenTrend | undefined
  loading: boolean
}) {
  const totals = useMemo(() => {
    const sum = { input: 0, output: 0, cacheRead: 0 }
    for (const bucket of trend?.buckets ?? []) {
      sum.input += bucket.input
      sum.output += bucket.output
      sum.cacheRead += bucket.cacheRead
    }
    return sum
  }, [trend])

  return (
    // Doubles as the legend: each figure carries its series dot.
    <dl className="grid gap-4 rounded-xl bg-row-alt px-5 py-4 sm:grid-cols-3">
      {(Object.keys(SERIES) as (keyof typeof SERIES)[]).map((key) => (
        <div key={key} className="flex min-w-0 gap-2.5">
          <span
            aria-hidden="true"
            className="mt-1.5 size-2.5 shrink-0 rounded-full"
            style={{ background: SERIES[key].color }}
          />
          <div className="flex min-w-0 flex-col gap-1">
            <dt className="text-sm text-muted-foreground">
              {SERIES[key].label}
            </dt>
            <dd className="font-mono text-2xl leading-tight font-bold tracking-[-0.3px] tabular-nums">
              {loading ? (
                <Skeleton className="my-0.5 h-7 w-24 rounded-lg bg-sk-strong" />
              ) : (
                formatTokens(totals[key])
              )}
            </dd>
          </div>
        </div>
      ))}
    </dl>
  )
}

export function TokenTrendChart({
  trend,
  loading,
}: {
  trend: TokenTrend | undefined
  loading: boolean
}) {
  const reducedMotion = useReducedMotion()
  const data = useMemo<Point[]>(
    () =>
      (trend?.buckets ?? []).map((bucket) => ({
        ...bucket,
        // The data's own unit: while a new period loads, the previous
        // period's buckets are still on screen.
        ...pointLabels(bucket.start, trend!.unit),
      })),
    [trend]
  )

  if (loading) return <Skeleton className="h-72 w-full rounded-md bg-sk-soft" />

  if (!data.some((point) => point.requests > 0)) {
    return (
      <Empty className="h-72 p-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ChartColumnIcon />
          </EmptyMedia>
          <EmptyTitle>所选时段暂无调用</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  }

  const animation = {
    isAnimationActive: !reducedMotion,
    animationDuration: 700,
    animationEasing: "ease-out",
  } as const
  const activeDot = (color: string) => ({
    r: 4,
    fill: color,
    stroke: "var(--card)",
    strokeWidth: 2,
  })

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
      <ComposedChart data={data} margin={{ top: 8, left: 0, right: 0 }}>
        <defs>
          <linearGradient id="fill-token-input" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-area-top)" />
            <stop offset="100%" stopColor="var(--chart-area-bottom)" />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="4 4" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          minTickGap={24}
        />
        {/* Input and cache share a scale; output is orders of magnitude
            smaller, so it reads off its own axis on the right. */}
        <YAxis
          yAxisId="input"
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(value: number) => compact.format(value)}
        />
        <YAxis
          yAxisId="output"
          orientation="right"
          tickLine={false}
          axisLine={false}
          width={52}
          tick={{ fill: SERIES.output.color }}
          tickFormatter={(value: number) => compact.format(value)}
        />
        <ChartTooltip
          cursor={{ strokeWidth: 1 }}
          content={(props) => <TrendTooltip {...props} />}
        />
        <Area
          yAxisId="input"
          dataKey="input"
          type="monotone"
          fill="url(#fill-token-input)"
          stroke={SERIES.input.color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          activeDot={activeDot(SERIES.input.color)}
          {...animation}
        />
        <Line
          yAxisId="input"
          dataKey="cacheRead"
          type="monotone"
          stroke={SERIES.cacheRead.color}
          strokeWidth={1.5}
          strokeDasharray="5 4"
          dot={false}
          activeDot={activeDot(SERIES.cacheRead.color)}
          {...animation}
        />
        <Line
          yAxisId="output"
          dataKey="output"
          type="monotone"
          stroke={SERIES.output.color}
          strokeWidth={2.5}
          strokeLinecap="round"
          dot={false}
          activeDot={activeDot(SERIES.output.color)}
          {...animation}
        />
      </ComposedChart>
    </ChartContainer>
  )
}

function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: unknown }>
}) {
  const point = payload?.[0]?.payload as Point | undefined
  if (!active || !point) return null

  const rows: { label: string; value: string; color: string }[] = [
    {
      label: SERIES.input.label,
      value: formatTokens(point.input),
      color: SERIES.input.color,
    },
    {
      label: SERIES.output.label,
      value: formatTokens(point.output),
      color: SERIES.output.color,
    },
    {
      label: SERIES.cacheRead.label,
      value: formatTokens(point.cacheRead),
      color: SERIES.cacheRead.color,
    },
    {
      label: "缓存命中",
      value: cacheHitRate(point.cacheRead, point.input),
      color: SERIES.cacheRead.color,
    },
    {
      label: "请求",
      value: formatNumber(point.requests),
      color: "var(--muted-foreground)",
    },
  ]

  return (
    <div className="grid min-w-44 gap-2 rounded-xl bg-popover px-3.5 py-3 text-xs text-popover-foreground shadow-popover">
      <div className="text-sm font-semibold tabular-nums">{point.title}</div>
      <div className="grid gap-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full"
              style={{ background: row.color }}
            />
            <span className="text-muted-foreground">{row.label}</span>
            <span className="ml-auto pl-4 font-medium text-foreground tabular-nums">
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
