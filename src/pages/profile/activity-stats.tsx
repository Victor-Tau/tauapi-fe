import type { ReactNode } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import type { ActivityStats } from "@/utils/activity"
import { formatNumber, formatTokens } from "@/utils/format"

const peakDay = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
})

function Days({ value }: { value: number }) {
  return (
    <>
      {formatNumber(value)}
      <span className="ml-1 font-sans text-base font-normal">天</span>
    </>
  )
}

/** Year-in-tokens figures beside the avatar; same window as the heatmap. */
export function ActivityStatsStrip({
  stats,
  loading,
}: {
  stats: ActivityStats | undefined
  loading: boolean
}) {
  const items: { label: string; value: ReactNode; title?: string }[] = [
    { label: "累计 Token 数", value: formatTokens(stats?.total) },
    {
      label: "峰值 Token 数",
      value: formatTokens(stats?.peak),
      title: stats?.peakDate
        ? `峰值日：${peakDay.format(new Date(`${stats.peakDate}T00:00:00`))}`
        : undefined,
    },
    {
      label: "活跃天数",
      value: stats ? <Days value={stats.activeDays} /> : "—",
    },
    {
      label: "当前连续天数",
      value: stats ? <Days value={stats.currentStreak} /> : "—",
    },
    {
      label: "最长连续天数",
      value: stats ? <Days value={stats.longestStreak} /> : "—",
    },
  ]

  return (
    <dl
      className="grid flex-1 grid-cols-2 gap-x-4 gap-y-5 rounded-xl bg-row-alt px-4 py-5 sm:grid-cols-5"
      title="近一年（与下方 Token 活动相同的时间范围）"
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="flex flex-col-reverse items-center gap-1.5 text-center"
          title={item.title}
        >
          <dt className="text-sm font-medium text-muted-foreground">
            {item.label}
          </dt>
          <dd className="font-mono text-xl leading-tight font-bold tabular-nums">
            {loading ? (
              <Skeleton className="h-6 w-16 rounded-md bg-sk-strong" />
            ) : (
              item.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}
