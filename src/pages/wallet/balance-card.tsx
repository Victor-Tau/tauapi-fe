import { useState } from "react"
import { ReceiptTextIcon } from "lucide-react"

import { DataPagination, pageCountOf } from "@/components/data-pagination"
import { ErrorAlert } from "@/components/error-alert"
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
import { useBalanceLogs } from "@/hooks/use-queries"
import { useSettledKey } from "@/hooks/use-settled-key"
import { cn } from "@/lib/utils"
import type { SiteStatus } from "@/types/api"
import {
  BALANCE_TYPES,
  balanceEntry,
  balanceTypeLabel,
  isNonBalanceLog,
} from "@/utils/balance"
import { formatNumber, formatUnixSeconds } from "@/utils/format"
import { formatQuotaPrecise } from "@/utils/wallet"

const PAGE_SIZE = 10

function signed(change: number | null, config: SiteStatus | undefined) {
  if (change === null) return "—"
  if (change === 0) return formatQuotaPrecise(0, config)
  const text = formatQuotaPrecise(Math.abs(change), config)
  return change > 0 ? `+${text}` : `−${text}`
}

/** Every record that moved the balance: top-ups, spend, refunds, bonuses. */
export function BalanceCard({ config }: { config: SiteStatus | undefined }) {
  const [type, setType] = useState(0)
  const [page, setPage] = useState(1)
  const logs = useBalanceLogs({ p: page, page_size: PAGE_SIZE, type })
  const rowsKey = useSettledKey(`${type}|${page}`, !logs.isPlaceholderData)
  const days = config?.log_max_range_days
  const total = logs.data?.total ?? 0
  // The server cannot filter these out, so they are dropped per page.
  const rows = logs.data?.items.filter((log) => !isNonBalanceLog(log)) ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>账单</CardTitle>
        <CardDescription>
          余额变化明细
          {days && days > 0 ? `（近 ${formatNumber(days)} 天）` : ""}
        </CardDescription>
        <CardAction>
          <ToggleGroup
            variant="outline"
            size="sm"
            spacing={0}
            value={[String(type)]}
            onValueChange={(value) => {
              const next = Number(value[0])
              if (value[0] !== undefined && Number.isInteger(next)) {
                setType(next)
                setPage(1)
              }
            }}
            aria-label="账单类型"
          >
            {BALANCE_TYPES.map((item) => (
              <ToggleGroupItem key={item.value} value={String(item.value)}>
                {item.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {logs.isError ? (
          <ErrorAlert
            error={logs.error}
            onRetry={() => void logs.refetch()}
            retrying={logs.isFetching}
          />
        ) : logs.isPending ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : logs.data.items.length ? (
          <>
            <Table
              className={cn(
                "whitespace-nowrap transition-opacity duration-200",
                logs.isPlaceholderData && "opacity-60"
              )}
            >
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>说明</TableHead>
                  <TableHead className="text-right">余额变化</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody key={rowsKey} className="swap-in">
                {!rows.length && (
                  <TableRow className="border-0">
                    <TableCell
                      colSpan={4}
                      className="py-6 text-center text-muted-foreground"
                    >
                      本页没有余额变化记录
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((log) => {
                  const entry = balanceEntry(log, config)
                  return (
                    <TableRow key={log.id} className="border-0 even:bg-row-alt">
                      <TableCell className="py-3 text-muted-foreground tabular-nums">
                        {formatUnixSeconds(log.created_at)}
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge variant="neutral">
                          {balanceTypeLabel(log.type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[28rem] py-3">
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate">{entry.title}</span>
                          {entry.detail && (
                            <span className="truncate text-xs text-muted-foreground">
                              {entry.detail}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "py-3 text-right font-medium tabular-nums",
                          !entry.change && "text-muted-foreground"
                        )}
                      >
                        {signed(entry.change, config)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <DataPagination
              summary={`共 ${formatNumber(total)} 条`}
              page={page}
              pageCount={pageCountOf(total, PAGE_SIZE)}
              onPageChange={setPage}
              disabled={logs.isFetching}
            />
          </>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ReceiptTextIcon />
              </EmptyMedia>
              <EmptyTitle>暂无账单记录</EmptyTitle>
              <EmptyDescription>
                充值、消费、退款与赠送会显示在这里。
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  )
}
