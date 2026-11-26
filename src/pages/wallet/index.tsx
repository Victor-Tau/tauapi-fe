import { useState } from "react"
import { ChevronRightIcon, KeyRoundIcon } from "lucide-react"
import { Link } from "react-router"
import { useQueryClient } from "@tanstack/react-query"

import { ErrorAlert } from "@/components/error-alert"
import { PageHeading } from "@/components/page-heading"
import { RefreshButton } from "@/components/refresh-button"
import { StatCard } from "@/components/stat-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { queryKeys } from "@/lib/query"
import {
  useAllKeys,
  useSelf,
  useSiteStatus,
  useTopUpInfo,
  useUsageStat,
} from "@/hooks/use-queries"
import type { ModelApiToken, SiteStatus } from "@/types/api"
import { formatQuota, getDateRange, quotaDisplay } from "@/utils/format"
import { keyStatus } from "@/utils/key-form"
import { resolvePreset } from "@/utils/time-range"
import { keySpend, recentDays } from "@/utils/wallet"

import { BalanceCard } from "./balance-card"
import { RedeemCard } from "./redeem-card"
import { StripeTopUpCard } from "./stripe-top-up-card"
import { VipCard } from "./vip-card"

/** Keys listed in the spend card; the rest open in a dialog. */
const TOP_KEYS = 3

type SpendPeriod = "today" | "recent" | "total"

export default function WalletPage() {
  const queryClient = useQueryClient()
  const self = useSelf()
  const site = useSiteStatus()
  const topUp = useTopUpInfo()
  const keys = useAllKeys()
  // Ranges end at "now", fixed for the visit and re-anchored on refresh, so
  // every render does not become a new query.
  const [now, setNow] = useState(() => new Date())
  const [period, setPeriod] = useState<SpendPeriod>("today")

  const config = site.data
  const user = self.data
  // The server rejects stat ranges beyond its log range limit.
  const days = recentDays(config?.log_max_range_days)
  const todayRange = resolvePreset("today", now)
  const recentRange = getDateRange(days, now)
  const today = useUsageStat(todayRange)
  // The number of days depends on the site status, so wait for it.
  const recent = useUsageStat(recentRange, site.isSuccess)

  const queries = [self, site, topUp, keys, today, recent]
  const failing = queries.filter((query) => query.isError)
  // The VIP card reports its own growth failure inline.
  const fetching = queries.some((query) => query.isFetching)

  const balance = quotaDisplay(user?.quota, config)
  const recentLabel = days === 1 ? "今日" : `近 ${days} 天`
  const periods = [
    { value: "today", label: "今日" },
    // With a 1-day log range "recent" equals today, so it is not offered.
    ...(days === 1 ? [] : [{ value: "recent", label: recentLabel }]),
    { value: "total", label: "累计" },
  ]
  const activePeriod = days === 1 && period === "recent" ? "today" : period
  const spend = {
    today: { quota: today.data?.quota, loading: today.isPending },
    recent: { quota: recent.data?.quota, loading: recent.isPending },
    total: { quota: user?.used_quota, loading: self.isPending },
  }[activePeriod]
  const spendDisplay = quotaDisplay(spend.quota, config)

  function refresh() {
    setNow(new Date())
    void self.refetch()
    void site.refetch()
    void topUp.refetch()
    void keys.refetch()
    void queryClient.invalidateQueries({ queryKey: queryKeys.growthAll })
    void queryClient.invalidateQueries({ queryKey: queryKeys.topUpOrders })
    void queryClient.invalidateQueries({ queryKey: ["balance-logs"] })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="我的钱包">
        <RefreshButton
          fetching={fetching}
          label="刷新钱包"
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

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <StatCard
              label="当前余额"
              value={balance.value}
              unit={balance.unit}
              loading={self.isPending}
            />
            <StatCard
              label={
                <>
                  <Select
                    items={periods}
                    value={activePeriod}
                    onValueChange={(value) => {
                      if (value) setPeriod(value as SpendPeriod)
                    }}
                  >
                    <SelectTrigger
                      size="sm"
                      aria-label="消费统计范围"
                      className="-ml-2 gap-0.5 bg-transparent py-0 pr-1 pl-2 text-muted-foreground hover:text-foreground data-[size=sm]:h-6"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {periods.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  消费
                </>
              }
              value={spendDisplay.value}
              unit={spendDisplay.unit}
              loading={spend.loading}
            />
          </div>
          <RedeemCard
            config={config}
            topUpLink={topUp.data?.topup_link}
            className="flex-1"
          />
        </div>
        <KeySpendCard
          tokens={keys.data}
          loading={keys.isPending}
          config={config}
        />
      </div>

      {topUp.data?.enable_stripe_topup && (
        <StripeTopUpCard config={config} info={topUp.data} />
      )}
      {self.isPending ? (
        <Skeleton className="h-64 w-full rounded-3xl bg-card" />
      ) : user ? (
        <VipCard user={user} />
      ) : null}

      <BalanceCard config={config} />
    </div>
  )
}

/** Spend per key, largest first, with its share of all keys' spend. */
function KeySpendCard({
  tokens,
  loading,
  config,
}: {
  tokens: ModelApiToken[] | undefined
  loading: boolean
  config: SiteStatus | undefined
}) {
  const { items, total } = keySpend(tokens ?? [])
  const shown = items.slice(0, TOP_KEYS)
  const [open, setOpen] = useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle>密钥消费</CardTitle>
        <CardAction className="flex items-center gap-2">
          {items.length > TOP_KEYS && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setOpen(true)}
            >
              查看全部 {items.length} 个
              <ChevronRightIcon data-icon="inline-end" />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link to="/keys" />}
          >
            <KeyRoundIcon data-icon="inline-start" />
            管理密钥
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : items.length ? (
          <ul className="flex flex-col">
            {shown.map(({ token, used, share }, index) => (
              <li key={token.id}>
                {index > 0 && <Separator />}
                <KeySpendRow
                  token={token}
                  used={used}
                  share={share}
                  config={config}
                />
              </li>
            ))}
            {total === 0 && (
              <li className="pt-3 text-sm text-muted-foreground">
                密钥尚未产生消费。
              </li>
            )}
          </ul>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <KeyRoundIcon />
              </EmptyMedia>
              <EmptyTitle>暂无 API 密钥</EmptyTitle>
              <EmptyDescription>
                创建密钥并调用后，消费会显示在这里。
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="grid-rows-[auto_minmax(0,1fr)] sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>密钥消费</DialogTitle>
            <DialogDescription>共 {items.length} 个密钥</DialogDescription>
          </DialogHeader>
          <ul className="-mx-5 flex flex-col overflow-y-auto px-5">
            {items.map(({ token, used, share }, index) => (
              <li key={token.id}>
                {index > 0 && <Separator />}
                <KeySpendRow
                  token={token}
                  used={used}
                  share={share}
                  config={config}
                />
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function KeySpendRow({
  token,
  used,
  share,
  config,
}: {
  token: ModelApiToken
  used: number
  share: number
  config: SiteStatus | undefined
}) {
  const status = keyStatus(token.status)
  // Unlimited keys still count remain_quota down (it goes negative), so
  // only limited keys have a meaningful remainder.
  const limit =
    token.unlimited_quota === undefined
      ? undefined
      : token.unlimited_quota
        ? "无限额"
        : `剩余 ${formatQuota(token.remain_quota, config)}`

  return (
    <div className="flex flex-col gap-2 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{token.name}</span>
          {token.status !== 1 && (
            <Badge variant="neutral">{status.label}</Badge>
          )}
        </div>
        <span className="shrink-0 font-medium tabular-nums">
          {formatQuota(used, config)}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-nav-active"
          role="meter"
          aria-label={`${token.name} 消费占比`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(share * 100)}
        >
          <div
            className="h-full rounded-full bg-foreground/35"
            style={{ width: `${share * 100}%` }}
          />
        </div>
        <span className="w-12 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
          {(share * 100).toFixed(1)}%
        </span>
        {limit && (
          <span className="w-32 shrink-0 truncate text-right text-xs text-muted-foreground tabular-nums">
            {limit}
          </span>
        )}
      </div>
    </div>
  )
}
