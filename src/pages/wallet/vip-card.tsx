import { cn } from "cn"
import { ChevronRightIcon, ReceiptTextIcon, SparklesIcon } from "lucide-react"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
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
} from "@/components/ui/dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { DataPagination, pageCountOf } from "@/components/data-pagination"
import { useGrowth, useVipConfig } from "@/hooks/use-queries"
import { useSettledKey } from "@/hooks/use-settled-key"
import type { GrowthEvent, SelfProfile } from "@/types/api"
import { formatUnixSeconds } from "@/utils/format"
import {
  accountTier,
  formatGrowth,
  growthSourceTitle,
  rebateText,
  tierLabel,
  vipProgress,
  type VipProgress,
  type VipTier,
} from "@/utils/vip"

import { TierIcon, tierTone, VipBadge } from "@/pages/profile/vip-badges"

/** Rows previewed under "成长值记录"; the rest open in a dialog. */
const PREVIEW_ROWS = 3
/** Rows per page in the "全部记录" dialog. */
const DIALOG_PAGE_SIZE = 20

function Progress({ progress }: { progress: VipProgress }) {
  const { current, next, amount, remaining, fraction } = progress
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <VipBadge tier={current} className="justify-self-start" />
        <span className="font-mono text-sm font-semibold tabular-nums">
          {formatGrowth(amount)}
          {next && ` / ${formatGrowth(next.minAmount)}`}
        </span>
        {next ? (
          <VipBadge
            tier={next}
            variant="outline"
            className="justify-self-end"
          />
        ) : (
          <span />
        )}
      </div>
      <div
        role="progressbar"
        aria-label="会员成长进度"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fraction * 100)}
        className="h-2 overflow-hidden rounded-full bg-nav-active"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width]",
            tierTone(current).fill
          )}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
      <p className="text-muted-foreground">
        {next
          ? `还需 ${formatGrowth(remaining)} 成长值可升级至 ${tierLabel(next)} ${next.name}。`
          : `已达最高等级，充值返利 ${rebateText(current)}`}
      </p>
    </div>
  )
}

/** Every tier with its threshold and rebate; the account's tier is marked. */
function TierLadder({
  tiers,
  current,
}: {
  tiers: readonly VipTier[]
  /** Undefined for a custom group: nothing is marked or locked. */
  current: VipTier | undefined
}) {
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {tiers.map((tier) => {
        const isCurrent = tier.level === current?.level
        const locked = current !== undefined && tier.level > current.level
        return (
          <li
            key={tier.key}
            aria-current={isCurrent ? "true" : undefined}
            className={cn(
              "flex flex-col gap-2 rounded-xl p-3",
              isCurrent ? tierTone(tier).soft : "bg-row-alt"
            )}
          >
            <div className="flex h-6 items-center justify-between">
              <TierIcon
                tier={tier}
                className={cn(
                  "size-5",
                  tierTone(tier).text,
                  locked && "opacity-55"
                )}
              />
              {isCurrent && <Badge variant="outline">当前</Badge>}
            </div>
            <div className="flex flex-col gap-0.5">
              <span
                className={cn("font-medium", locked && "text-muted-foreground")}
              >
                {tierLabel(tier)} {tier.name}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {tier.minAmount > 0
                  ? `成长值 ${formatGrowth(tier.minAmount)}`
                  : "注册即享"}
              </span>
            </div>
            <div
              className={cn(
                "flex items-baseline justify-between gap-2 font-mono text-base font-semibold tabular-nums",
                locked && "text-muted-foreground"
              )}
            >
              <span>充值折扣</span>
              <span>{tier.ratio < 1 ? rebateText(tier) : "无"}</span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function GrowthRecordRow({ record }: { record: GrowthEvent }) {
  const sign = record.amount < 0 ? "−" : "+"
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-medium">
          {growthSourceTitle(record)}
        </span>
        <span className="truncate text-xs text-muted-foreground tabular-nums">
          {formatUnixSeconds(record.created_at)}
        </span>
      </div>
      <span className="shrink-0 font-mono font-semibold tabular-nums">
        {sign}
        {formatGrowth(Math.abs(record.amount))}
      </span>
    </div>
  )
}

function GrowthRecordList({
  records,
  className,
}: {
  records: GrowthEvent[]
  className?: string
}) {
  return (
    <ul className={cn("flex flex-col", className)}>
      {records.map((record, index) => (
        <li key={record.id}>
          {index > 0 && <Separator />}
          <GrowthRecordRow record={record} />
        </li>
      ))}
    </ul>
  )
}

/** Every record of the window, paged by the server. Mounted only while open. */
function AllGrowthRecords({ windowDays }: { windowDays: number }) {
  const [page, setPage] = useState(1)
  const growth = useGrowth(page, DIALOG_PAGE_SIZE)
  const rowsKey = useSettledKey(page, !growth.isPlaceholderData)
  const records = growth.data?.records
  return (
    <>
      <DialogHeader>
        <DialogTitle>成长值记录</DialogTitle>
        <DialogDescription>
          近 {windowDays} 天到账的充值与兑换码
          {records && `，共 ${records.total} 条`}
        </DialogDescription>
      </DialogHeader>
      {growth.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 rounded-md bg-sk-strong" />
          <Skeleton className="h-10 rounded-md bg-sk-strong" />
        </div>
      ) : growth.isError || !records ? (
        <p className="py-6 text-center text-muted-foreground">
          成长值记录加载失败，请稍后重试
        </p>
      ) : (
        <div className="flex min-h-0 flex-col gap-3">
          <GrowthRecordList
            key={rowsKey}
            records={records.items}
            className={cn(
              "swap-in swap-fade -mx-5 min-h-0 overflow-y-auto px-5 transition-opacity duration-200",
              growth.isPlaceholderData && "opacity-60"
            )}
          />
          {records.total > DIALOG_PAGE_SIZE && (
            <DataPagination
              summary={`共 ${records.total} 条`}
              page={page}
              pageCount={pageCountOf(records.total, DIALOG_PAGE_SIZE)}
              onPageChange={setPage}
              disabled={growth.isFetching}
            />
          )}
        </div>
      )}
    </>
  )
}

function GrowthRecords({
  records,
  total,
  loading,
  failed,
  windowDays,
}: {
  records: GrowthEvent[]
  total: number
  loading: boolean
  failed: boolean
  windowDays: number
}) {
  const [open, setOpen] = useState(false)
  const hasMore = !loading && !failed && total > records.length

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-heading text-base font-medium">成长值记录</h3>
        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setOpen(true)}
          >
            查看全部 {total} 条
            <ChevronRightIcon data-icon="inline-end" />
          </Button>
        )}
      </div>
      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 rounded-md bg-sk-strong" />
          <Skeleton className="h-10 rounded-md bg-sk-strong" />
        </div>
      ) : failed ? (
        <p className="py-6 text-center text-muted-foreground">
          成长值记录加载失败，请稍后刷新
        </p>
      ) : records.length === 0 ? (
        <Empty className="py-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ReceiptTextIcon />
            </EmptyMedia>
            <EmptyTitle>暂无成长值记录</EmptyTitle>
            <EmptyDescription>充值、兑换码到账后会计入成长值</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <GrowthRecordList records={records} />
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="grid-rows-[auto_minmax(0,1fr)] sm:max-w-md">
          {open && <AllGrowthRecords windowDays={windowDays} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Growth value only, for a custom group outside the tier programme. */
function CustomGroupNote({ amount }: { amount: number | undefined }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-sm font-semibold tabular-nums">
        成长值 {formatGrowth(amount)}
      </span>
      <p className="text-muted-foreground">
        当前账户为自定义分组，充值价格按分组单独配置，不参与会员自动升降级。
      </p>
    </div>
  )
}

/** VIP level, progress to the next one, the tier ladder and growth records. */
export function VipCard({ user }: { user: SelfProfile }) {
  const { tiers, windowDays: siteWindow } = useVipConfig()
  const growth = useGrowth(1, PREVIEW_ROWS)
  const data = growth.data
  // The growth endpoint's level is read with the total; fall back to the profile.
  const current = accountTier(
    data ? { group: user.group, vip_level: data.level } : user,
    tiers
  )
  const windowDays = data?.window_days ?? siteWindow
  const progress = current
    ? vipProgress(current, tiers, data?.amount)
    : undefined
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <SparklesIcon
            className={cn(
              "size-4",
              current ? tierTone(current).text : "text-muted-foreground"
            )}
          />
          会员体系
        </CardTitle>
        <CardDescription>
          成长值为近 {windowDays} 天累计到账金额（含兑换码）
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-5">
          {progress ? (
            <Progress progress={progress} />
          ) : (
            <CustomGroupNote amount={data?.amount} />
          )}
          <TierLadder tiers={tiers} current={current} />
        </div>
        <GrowthRecords
          records={data?.records.items ?? []}
          total={data?.records.total ?? 0}
          loading={growth.isPending}
          failed={growth.isError}
          windowDays={windowDays}
        />
      </CardContent>
    </Card>
  )
}
