import { useEffect, useState } from "react"
import { GiftIcon, ReceiptTextIcon, UsersIcon } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"

import { ApiError } from "@/api/errors"
import {
  isAwaitingCredit,
  isCancelled,
  type ReferralRebate,
} from "@/api/referral"
import { CopyButton } from "@/components/copy-button"
import { DataPagination, pageCountOf } from "@/components/data-pagination"
import { ErrorAlert } from "@/components/error-alert"
import { PageHeading } from "@/components/page-heading"
import { RefreshButton } from "@/components/refresh-button"
import { StatCard } from "@/components/stat-card"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  useAffCode,
  useInvitees,
  useAllRebates,
  useReferralPermissions,
  useSelf,
  useSiteStatus,
} from "@/hooks/use-queries"
import { useSettledKey } from "@/hooks/use-settled-key"
import { queryKeys } from "@/lib/query"
import { cn } from "@/lib/utils"
import type { SiteStatus } from "@/types/api"
import { formatNumber, formatQuota, formatUnixSeconds } from "@/utils/format"

const PAGE_SIZE = 10

/** 750 bps → "7.5%". */
function formatRate(bps: number | undefined): string {
  if (bps == null || !Number.isFinite(bps)) return "—"
  return `${new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(bps / 100)}%`
}

/**
 * Whole hours from one hour up (4500 → "1 小时"), minutes below
 * (1800 → "30 分钟"; under a minute rounds up to "1 分钟").
 */
function formatRemaining(seconds: number): string {
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)} 小时`
  return `${Math.max(1, Math.ceil(seconds / 60))} 分钟`
}

/** Current time, re-read every minute while `active`. */
function useMinuteClock(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    // A stale `now` before the first tick only clamps elapsed to 0.
    const id = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [active])
  return now
}

function rebateStatus(row: ReferralRebate) {
  // Order matters: cancelled_at first, then credited_at.
  if (isCancelled(row)) return { label: "已取消", variant: "neutral" } as const
  if (row.credited_at > 0)
    return { label: "已到账", variant: "success" } as const
  if (row.exchange_rate_pending === true)
    return { label: "待汇率", variant: "warning" } as const
  if (row.rebate_quota > 0)
    return { label: "待入账", variant: "warning" } as const
  return null
}

/** A 403 from a list means a permission was switched off: reload permissions. */
function useForbiddenRefresh(error: unknown) {
  const queryClient = useQueryClient()
  const forbidden = error instanceof ApiError && error.status === 403
  useEffect(() => {
    if (forbidden)
      void queryClient.invalidateQueries({
        queryKey: queryKeys.referralPermissions,
      })
  }, [forbidden, queryClient])
}

export default function ReferralPage() {
  const queryClient = useQueryClient()
  const permissions = useReferralPermissions()
  const self = useSelf()
  const site = useSiteStatus()
  const [inviteePage, setInviteePage] = useState(1)

  const invitation = permissions.data?.invitation_enabled === true
  const rebate = permissions.data?.rebate_enabled === true
  const invitees = useInvitees(inviteePage, PAGE_SIZE, invitation)
  // One list holds both fixed rewards (invitation) and rebates (rebate).
  const rebates = useAllRebates(invitation || rebate)
  useForbiddenRefresh(invitees.error)
  useForbiddenRefresh(rebates.error)

  // Prefer the code already on the profile; generate one only when missing.
  const ownCode = self.data?.aff_code?.trim()
  const affCode = useAffCode(invitation && self.isSuccess && !ownCode)
  const code = ownCode || affCode.data
  const link = code
    ? (() => {
        const url = new URL("/register", window.location.origin)
        url.searchParams.set("aff", code)
        return url.href
      })()
    : undefined

  const fetching =
    permissions.isFetching ||
    self.isFetching ||
    invitees.isFetching ||
    rebates.isFetching

  function refresh() {
    void self.refetch()
    void queryClient.invalidateQueries({ queryKey: queryKeys.referralAll })
  }

  const header = (
    <PageHeading title="邀请返利" description="">
      <RefreshButton fetching={fetching} label="刷新" onRefresh={refresh} />
    </PageHeading>
  )

  if (permissions.isPending) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="grid gap-6 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-[104px] rounded-3xl bg-card" />
          ))}
        </div>
        <Skeleton className="h-48 w-full rounded-3xl bg-card" />
      </div>
    )
  }

  if (permissions.isError) {
    // The public gateway answers 404 until the referral routes are allowed.
    const unavailable =
      permissions.error instanceof ApiError && permissions.error.status === 404
    return (
      <div className="flex flex-col gap-6">
        {header}
        {unavailable ? (
          <Unavailable />
        ) : (
          <ErrorAlert
            error={permissions.error}
            onRetry={() => void permissions.refetch()}
            retrying={permissions.isFetching}
          />
        )}
      </div>
    )
  }

  if (!invitation && !rebate) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <Unavailable />
      </div>
    )
  }

  const rate = formatRate(permissions.data.rate_bps ?? 0)
  const inviteeCount = invitees.data?.total ?? self.data?.aff_count
  // Credited top-up rebates only; pending and cancelled ones are excluded.
  const topupRebateTotal = (rebates.data?.items ?? []).reduce(
    (sum, row) =>
      row.record_type === "topup_rebate" &&
      !isCancelled(row) &&
      row.credited_at > 0
        ? sum + row.rebate_quota
        : sum,
    0
  )

  return (
    <div className="flex flex-col gap-6">
      {header}

      <div
        className={cn(
          "grid gap-6 sm:grid-cols-2",
          invitation && rebate && "lg:grid-cols-4"
        )}
      >
        {rebate && <StatCard label="我的返利比例" value={rate} />}
        {invitation && (
          <StatCard
            label="邀请人数"
            value={formatNumber(inviteeCount)}
            loading={inviteeCount == null && invitees.isPending}
          />
        )}
        {invitation && (
          <StatCard
            label="累计邀新返利"
            value={formatQuota(self.data?.aff_history_quota ?? 0, site.data)}
            loading={self.isPending || site.isPending}
          />
        )}
        {rebate && (
          <StatCard
            label="累计充值返利"
            value={formatQuota(topupRebateTotal, site.data)}
            loading={rebates.isPending || site.isPending}
          />
        )}
      </div>

      {invitation && (
        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          <Card>
            <CardHeader>
              <CardTitle>我的邀请</CardTitle>
              <CardDescription>
                把邀请码或邀请链接分享给新用户，对方注册时会自动关联到你。
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {affCode.isError && !code ? (
                <ErrorAlert
                  error={affCode.error}
                  onRetry={() => void affCode.refetch()}
                  retrying={affCode.isFetching}
                />
              ) : (
                <>
                  <CopyField
                    id="aff-code"
                    label="邀请码"
                    value={code}
                    what="邀请码"
                    mono
                  />
                  <CopyField
                    id="aff-link"
                    label="邀请链接"
                    value={link}
                    what="邀请链接"
                  />
                </>
              )}
            </CardContent>
          </Card>
          <GuideCard invitation rate={rebate ? rate : null} />
        </div>
      )}

      {!invitation && <GuideCard invitation={false} rate={rate} />}

      <div
        className={cn(
          "grid items-start gap-6",
          invitation && "lg:grid-cols-[2fr_5fr]"
        )}
      >
        {invitation && (
          <Card>
            <CardHeader>
              <CardTitle>邀请名单</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <InviteesTable
                query={invitees}
                page={inviteePage}
                onPageChange={setInviteePage}
              />
            </CardContent>
          </Card>
        )}
        <RecordsCard
          invitation={invitation}
          rebate={rebate}
          rebates={rebates}
          config={site.data}
        />
      </div>
    </div>
  )
}

function Unavailable() {
  return (
    <Card>
      <CardContent>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <GiftIcon />
            </EmptyMedia>
            <EmptyTitle>邀请返利暂未开放</EmptyTitle>
            <EmptyDescription>
              当前账户暂不能使用邀请与返利功能，如有疑问请联系管理员。
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </CardContent>
    </Card>
  )
}

function CopyField({
  id,
  label,
  value,
  what,
  mono = false,
}: {
  id: string
  label: string
  value: string | undefined
  what: string
  mono?: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-muted-foreground">
        {label}
      </Label>
      <div className="flex gap-2">
        {value ? (
          <Input
            id={id}
            readOnly
            value={value}
            className={cn("tabular-nums", mono && "font-mono tracking-wide")}
            onFocus={(event) => event.currentTarget.select()}
          />
        ) : (
          <Skeleton className="h-9 flex-1 rounded-md" />
        )}
        <CopyButton
          variant="outline"
          text={value ?? ""}
          what={what}
          disabled={!value}
          className="shrink-0"
        >
          复制
        </CopyButton>
      </div>
    </div>
  )
}

function GuideCard({
  invitation,
  rate,
}: {
  /** Fixed invitation reward available to this account. */
  invitation: boolean
  /** Null when rebates are off for this account. */
  rate: string | null
}) {
  const steps = [
    "把邀请码或邀请链接分享给新用户，对方通过它完成注册。",
    ...(invitation ? ["新用户注册成功后，你获得一笔固定的邀新奖励。"] : []),
    ...(rate !== null
      ? [`被邀请用户每次充值（含兑换码充值）后，你获得 ${rate} 的充值返利。`]
      : []),
    "奖励会先冻结一段时间，到期后直接计入余额，无需手动转入。",
    "到账进度可在「奖励记录」中查看。",
  ]
  return (
    <Card>
      <CardHeader>
        <CardTitle>使用说明</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-3">
          {steps.map((step, index) => (
            <li key={step} className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-nav-active text-xs font-medium tabular-nums">
                {index + 1}
              </span>
              <span className="pt-0.5 leading-5">{step}</span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}

type ListQuery<T> = {
  dataUpdatedAt?: number
  data?: { total: number; items: T[] }
  error: unknown
  isError: boolean
  isPending: boolean
  isFetching: boolean
  isPlaceholderData: boolean
  refetch: () => unknown
}

function ListState<T>({
  query,
  page,
  onPageChange,
  empty,
  children,
}: {
  query: ListQuery<T>
  page: number
  onPageChange: (page: number) => void
  empty: React.ReactNode
  children: (items: T[], rowsKey: string | number) => React.ReactNode
}) {
  const rowsKey = useSettledKey(page, !query.isPlaceholderData)
  if (query.isError)
    return (
      <ErrorAlert
        error={query.error}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    )
  if (query.isPending || !query.data)
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    )
  if (!query.data.items.length) return <>{empty}</>
  const total = query.data.total
  return (
    <>
      <div
        className={cn(
          "transition-opacity duration-200",
          query.isPlaceholderData && "opacity-60"
        )}
      >
        {children(query.data.items, rowsKey)}
      </div>
      <DataPagination
        summary={`共 ${formatNumber(total)} 条`}
        page={page}
        pageCount={pageCountOf(total, PAGE_SIZE)}
        onPageChange={onPageChange}
        disabled={query.isFetching}
      />
    </>
  )
}

function InviteesTable({
  query,
  page,
  onPageChange,
}: {
  query: ReturnType<typeof useInvitees>
  page: number
  onPageChange: (page: number) => void
}) {
  return (
    <ListState
      query={query}
      page={page}
      onPageChange={onPageChange}
      empty={
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersIcon />
            </EmptyMedia>
            <EmptyTitle>还没有邀请到用户</EmptyTitle>
            <EmptyDescription>
              把邀请链接发给朋友，对方用它注册后会出现在这里。
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      }
    >
      {(items, rowsKey) => (
        <Table className="whitespace-nowrap">
          <TableHeader>
            <TableRow>
              <TableHead>用户名</TableHead>
              <TableHead>邮箱</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody key={rowsKey} className="swap-in">
            {items.map((row) => (
              <TableRow key={row.id} className="border-0 even:bg-row-alt">
                <TableCell className="py-3 font-medium">
                  {row.username}
                </TableCell>
                <TableCell className="py-3 text-muted-foreground">
                  {row.email || "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </ListState>
  )
}

type RecordTab = "all" | "rebate" | "bonus"

const TAB_TYPE = {
  rebate: "topup_rebate",
  bonus: "invitation_reward",
} as const

/** Fixed invitation rewards and top-up rebates in one card, filtered by a toggle. */
function RecordsCard({
  invitation,
  rebate,
  rebates,
  config,
}: {
  invitation: boolean
  rebate: boolean
  rebates: ReturnType<typeof useAllRebates>
  config: SiteStatus | undefined
}) {
  const sources = [
    ...(rebate ? [{ value: "rebate" as const, label: "充值返利" }] : []),
    ...(invitation ? [{ value: "bonus" as const, label: "邀新返利" }] : []),
  ]
  const tabs =
    sources.length > 1
      ? [{ value: "all" as const, label: "全部" }, ...sources]
      : sources
  const [picked, setPicked] = useState<RecordTab>("all")
  const [page, setPage] = useState(1)
  // Fall back when the picked tab's permission is off.
  const tab = tabs.some((item) => item.value === picked)
    ? picked
    : (tabs[0]?.value ?? "all")

  // The server already returns them newest first.
  const all = rebates.data?.items ?? []
  const rows =
    tab === "all" ? all : all.filter((row) => row.record_type === TAB_TYPE[tab])

  // remaining_seconds is measured when the list was fetched; count it down
  // locally between the minute polls.
  const waiting = all.some(isAwaitingCredit)
  const now = useMinuteClock(waiting)
  const elapsed = Math.max(0, (now - rebates.dataUpdatedAt) / 1000)

  const query: ListQuery<ReferralRebate> = {
    data: rebates.data && {
      total: rows.length,
      items: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    },
    error: rebates.error,
    isError: rebates.isError,
    isPending: rebates.isPending,
    isFetching: rebates.isFetching,
    isPlaceholderData: false,
    refetch: () => void rebates.refetch(),
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>返利记录</CardTitle>
        {tabs.length > 1 && (
          <CardAction>
            <ToggleGroup
              variant="outline"
              size="sm"
              spacing={0}
              value={[tab]}
              onValueChange={(value) => {
                if (value[0]) {
                  setPicked(value[0] as RecordTab)
                  setPage(1)
                }
              }}
              aria-label="返利类型"
            >
              {tabs.map((item) => (
                <ToggleGroupItem key={item.value} value={item.value}>
                  {item.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ListState
          query={query}
          page={page}
          onPageChange={setPage}
          empty={
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ReceiptTextIcon />
                </EmptyMedia>
                <EmptyTitle>暂无返利记录</EmptyTitle>
                <EmptyDescription>
                  被邀请用户注册或充值后，返利会显示在这里。
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          }
        >
          {(items, rowsKey) => (
            <Table className="whitespace-nowrap">
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>被邀用户</TableHead>
                  <TableHead>说明</TableHead>
                  <TableHead className="text-right">返利</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody key={`${tab}|${rowsKey}`} className="swap-in">
                {items.map((row) => (
                  <RewardTableRow
                    key={`${row.record_type}-${row.id}`}
                    row={row}
                    elapsed={elapsed}
                    config={config}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </ListState>
        {rebates.data && !rebates.data.complete && (
          <p className="text-xs text-muted-foreground">
            记录较多，仅显示最近的部分。
          </p>
        )}
      </CardContent>
    </Card>
  )
}

/** Type label and the line under the invited user. */
function rowKind(row: ReferralRebate, config: SiteStatus | undefined) {
  if (row.record_type === "invitation_reward")
    return { label: "邀新返利", detail: "邀请新用户注册" }
  if (row.redemption_quota !== undefined)
    return {
      label: "充值返利",
      detail: `兑换码充值 ${formatQuota(row.redemption_quota, config)} · 比例 ${formatRate(row.rate_bps)}`,
    }
  return {
    label: "充值返利",
    detail: `在线充值实付 ${row.paid_amount} ${row.paid_currency} · 比例 ${formatRate(row.rate_bps)}`,
  }
}

function RewardTableRow({
  row,
  elapsed,
  config,
}: {
  row: ReferralRebate
  elapsed: number
  config: SiteStatus | undefined
}) {
  const kind = rowKind(row, config)
  const status = rebateStatus(row)
  const cancelled = isCancelled(row)
  const remaining =
    isAwaitingCredit(row) && row.remaining_seconds !== undefined
      ? row.remaining_seconds - elapsed
      : null
  // While counting down, the badge itself says when; at zero it falls back
  // to 「待入账」 until credited_at > 0.
  const label =
    status && remaining !== null && remaining > 0
      ? `${formatRemaining(remaining)}后入账`
      : status?.label
  return (
    <TableRow className="border-0 even:bg-row-alt">
      <TableCell className="py-3 text-muted-foreground tabular-nums">
        {formatUnixSeconds(row.created_at)}
      </TableCell>
      <TableCell className="py-3">
        <Badge variant="neutral">{kind.label}</Badge>
      </TableCell>
      <TableCell className="py-3">
        {row.username ? (
          <span className="font-medium">{row.username}</span>
        ) : (
          // Deleted invitees come back with an empty username.
          <span className="text-muted-foreground">已删除用户</span>
        )}
      </TableCell>
      <TableCell className="py-3 text-muted-foreground tabular-nums">
        {kind.detail}
      </TableCell>
      <TableCell
        className={cn(
          "py-3 text-right font-medium tabular-nums",
          // Cancelled rewards keep their original amount but never arrive.
          cancelled && "text-muted-foreground line-through"
        )}
      >
        +{formatQuota(row.rebate_quota, config)}
      </TableCell>
      <TableCell className="py-3">
        {status ? (
          <Badge variant={status.variant}>{label}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  )
}
