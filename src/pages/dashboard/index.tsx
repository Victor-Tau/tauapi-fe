import { useState } from "react"
import { EyeIcon, FileJsonIcon, EyeOffIcon, PlusIcon } from "lucide-react"
import { Link } from "react-router"
import { useQueryClient } from "@tanstack/react-query"

import type { TrendUnit } from "@/api/usage"
import { ErrorAlert } from "@/components/error-alert"
import { CopyButton } from "@/components/copy-button"
import { PageHeading } from "@/components/page-heading"
import { RefreshButton } from "@/components/refresh-button"
import { StatCard } from "@/components/stat-card"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useAuth } from "@/hooks/use-auth"
import {
  KEYS_PAGE_SIZE,
  useKeys,
  useSelf,
  useSiteStatus,
  useTokenTrend,
} from "@/hooks/use-queries"
import { CLAUDE_CODE_SETTINGS, SDK_BASE_URL } from "@/lib/endpoint"
import { queryKeys } from "@/lib/query"
import { formatNumber, quotaDisplay } from "@/utils/format"
import { exceedsMaxRange, resolvePreset } from "@/utils/time-range"

import { AnnouncementsCard } from "./announcements-card"
import { TokenTrendChart, TokenTrendSummary } from "./token-trend-card"

const PERIODS = {
  today: {
    label: "今天",
    preset: "today",
    unit: "hour",
    caption: "今日按小时汇总",
  },
  "7d": {
    label: "7 天",
    preset: "7d",
    unit: "day",
    caption: "近 7 天按日汇总",
  },
  "30d": {
    label: "30 天",
    preset: "30d",
    unit: "day",
    caption: "近 30 天按日汇总",
  },
} as const satisfies Record<
  string,
  {
    label: string
    preset: "today" | "7d" | "30d"
    unit: TrendUnit
    caption: string
  }
>

type Period = keyof typeof PERIODS

function isPeriod(value: unknown): value is Period {
  return typeof value === "string" && value in PERIODS
}

export default function DashboardPage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const self = useSelf()
  const site = useSiteStatus()
  const [period, setPeriod] = useState<Period>("today")
  // A fixed range per selection: presets end at "now", so it must not be
  // recomputed on every render or every render would be a new query.
  const [range, setRange] = useState(() => resolvePreset("today"))
  // Figures the user has masked (e.g. while sharing the screen).
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set())

  function toggleHidden(key: string) {
    setHidden((current) => {
      const next = new Set(current)
      if (!next.delete(key)) next.add(key)
      return next
    })
  }

  const keys = useKeys(1, KEYS_PAGE_SIZE)
  const { unit, caption } = PERIODS[period]
  const trend = useTokenTrend(range, unit)

  const config = site.data
  const profile = self.data ?? user
  const balance = quotaDisplay(self.data?.quota, config)
  const used = quotaDisplay(self.data?.used_quota, config)

  const failing = [keys, trend, site].filter((query) => query.isError)
  const fetching = [self, keys, trend, site].some((q) => q.isFetching)

  function selectPeriod(next: Period) {
    setPeriod(next)
    setRange(resolvePreset(PERIODS[next].preset))
  }

  function refresh() {
    setRange(resolvePreset(PERIODS[period].preset))
    void queryClient.invalidateQueries({ queryKey: queryKeys.self })
    void queryClient.invalidateQueries({ queryKey: queryKeys.keysAll })
    // Announcements come with the site status.
    void site.refetch()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        title={`欢迎回来，${profile?.display_name || profile?.username || "你"}`}
      >
        <RefreshButton
          fetching={fetching}
          label="刷新总览"
          onRefresh={refresh}
        />
      </PageHeading>

      {failing[0] && (
        <ErrorAlert
          error={failing[0].error}
          onRetry={() => failing.forEach((query) => void query.refetch())}
          retrying={failing.some((query) => query.isFetching)}
        />
      )}

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,1fr))_380px]">
        {[
          {
            key: "balance",
            label: "当前可用余额",
            value: balance.value,
            unit: balance.unit,
            loading: self.isPending,
          },
          {
            key: "used",
            label: "累计花费",
            value: used.value,
            unit: used.unit,
            loading: self.isPending,
          },
          {
            key: "requests",
            label: "累计请求次数",
            value: formatNumber(self.data?.request_count),
            unit: "次",
            loading: self.isPending,
          },
          {
            key: "keys",
            label: "API 密钥",
            value: keys.data ? formatNumber(keys.data.total) : "—",
            unit: "个",
            loading: keys.isPending,
          },
        ].map((card) => {
          const isHidden = hidden.has(card.key)
          return (
            <StatCard
              key={card.key}
              label={card.label}
              value={isHidden ? <MaskedValue /> : card.value}
              unit={card.unit}
              loading={card.loading}
              action={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground"
                  aria-label={`${isHidden ? "显示" : "隐藏"}${card.label}`}
                  aria-pressed={isHidden}
                  onClick={() => toggleHidden(card.key)}
                >
                  {isHidden ? <EyeIcon /> : <EyeOffIcon />}
                </Button>
              }
            />
          )
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <CardTitle>用量趋势</CardTitle>
            <CardDescription>
              {caption}
              {trend.data?.complete === false &&
                "（记录过多，仅统计了最近 30,000 条）"}
            </CardDescription>
            <CardAction>
              <ToggleGroup
                variant="outline"
                size="sm"
                spacing={0}
                value={[period]}
                onValueChange={(value) => {
                  if (isPeriod(value[0])) selectPeriod(value[0])
                }}
                aria-label="趋势时段"
              >
                {(Object.keys(PERIODS) as Period[]).map((key) => {
                  // The server rejects ranges beyond its log range limit.
                  const tooLong = exceedsMaxRange(
                    resolvePreset(PERIODS[key].preset),
                    config?.log_max_range_days
                  )
                  return (
                    <ToggleGroupItem
                      key={key}
                      value={key}
                      disabled={tooLong}
                      title={
                        tooLong
                          ? `最大查询范围为 ${config?.log_max_range_days} 天`
                          : undefined
                      }
                    >
                      {PERIODS[key].label}
                    </ToggleGroupItem>
                  )
                })}
              </ToggleGroup>
            </CardAction>
          </CardHeader>
          <CardContent
            className={
              trend.isPlaceholderData
                ? "flex flex-col gap-5 opacity-60 transition-opacity"
                : "flex flex-col gap-5 transition-opacity"
            }
          >
            <TokenTrendSummary trend={trend.data} loading={trend.isPending} />
            <TokenTrendChart trend={trend.data} loading={trend.isPending} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>快速开始</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-5">
              <QuickStep
                index={1}
                title="创建专属密钥"
                body="按应用设置额度与模型权限。"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="self-start"
                  nativeButton={false}
                  render={<Link to="/keys?create=1" />}
                >
                  <PlusIcon data-icon="inline-start" />
                  添加 API 密钥
                </Button>
              </QuickStep>
              <QuickStep
                index={2}
                title="接入兼容 SDK"
                body="在客户端配置密钥和调用地址。"
              >
                <EndpointField label="调用地址" url={SDK_BASE_URL} />
              </QuickStep>
              <QuickStep
                index={3}
                title="配置 Claude Code"
                body="写入 ~/.claude/settings.json 即可使用。"
              >
                <ClaudeCodeSettingsDialog />
              </QuickStep>
            </ol>
          </CardContent>
        </Card>
      </div>

      <AnnouncementsCard config={config} loading={site.isPending} />
    </div>
  )
}

function QuickStep({
  index,
  title,
  body,
  note,
  children,
}: {
  index: number
  title: string
  body: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-nav-active text-xs font-medium tabular-nums">
        {index}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{title}</span>
          <span className="text-muted-foreground">{body}</span>
          {note && <span className="text-[#D08A2A]">{note}</span>}
        </div>
        {children}
      </div>
    </li>
  )
}

function EndpointField({ label, url }: { label: string; url: string }) {
  return (
    <div className="flex min-h-9 min-w-0 items-center gap-1 rounded-lg bg-row-alt py-1.5 pr-1 pl-3">
      <code className="min-w-0 flex-1 font-mono text-[13px] leading-snug whitespace-nowrap">
        {url}
      </code>
      <CopyButton
        variant="ghost"
        size="icon-sm"
        className="shrink-0 text-muted-foreground"
        aria-label={`复制${label}`}
        title={label}
        text={url}
        what={label}
      />
    </div>
  )
}

/** A Claude Code settings.json example pointing at this API. */
function ClaudeCodeSettingsDialog() {
  return (
    <Dialog>
      <DialogTrigger
        render={<Button variant="outline" size="sm" className="self-start" />}
      >
        <FileJsonIcon data-icon="inline-start" />
        查看配置示例
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Claude Code 配置示例</DialogTitle>
          <DialogDescription>
            保存为 ~/.claude/settings.json，并将 ANTHROPIC_AUTH_TOKEN 替换为你的
            API 密钥。
          </DialogDescription>
        </DialogHeader>
        <div className="relative min-h-0 overflow-hidden rounded-lg bg-row-alt">
          <pre className="max-h-[60svh] overflow-auto p-3 pr-12 font-mono text-[13px] leading-relaxed">
            {CLAUDE_CODE_SETTINGS}
          </pre>
          <CopyButton
            variant="ghost"
            size="icon-sm"
            className="absolute top-1.5 right-1.5 text-muted-foreground"
            aria-label="复制配置"
            text={CLAUDE_CODE_SETTINGS}
            what="配置"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The mask for a hidden figure. Dots have no side bearing, so set flush with
 * the label they read as sitting too far left; a 3px optical inset fixes it
 * (padding, not a transform, so the truncating parent does not clip it).
 */
function MaskedValue() {
  return (
    <span className="inline-block pl-[3px]" aria-label="已隐藏">
      ••••••
    </span>
  )
}
