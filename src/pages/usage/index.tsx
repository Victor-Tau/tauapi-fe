import { useEffect, useMemo, useState } from "react"
import {
  ActivityIcon,
  ChartColumnIcon,
  DatabaseIcon,
  FileTextIcon,
  RotateCwIcon,
  SearchXIcon,
  WalletIcon,
} from "lucide-react"
import { cn } from "cn"

import { DataPagination, pageCountOf } from "@/components/data-pagination"
import { ErrorAlert } from "@/components/error-alert"
import { PageHeading } from "@/components/page-heading"
import { IconStatCard } from "@/components/stat-card"
import { TimeRangePicker } from "@/components/time-range-picker"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { InputGroup, InputGroupInput } from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  LOGS_PAGE_SIZE,
  useKeyNames,
  useLogTotals,
  useLogs,
  useSiteStatus,
  useUsageStat,
  useUserModels,
} from "@/hooks/use-queries"
import type { UsageLog, UsageLogFilters } from "@/types/api"
import { formatNumber, formatQuota, formatTokens } from "@/utils/format"
import { resolveRange, type TimeRange } from "@/utils/time-range"

import {
  ColumnSettings,
  useVisibleColumns,
  ViewButton,
  type CellContext,
} from "./log-columns"
import { LogDetailSheet } from "./log-detail-sheet"

const DEFAULT_PRESET = "7d"
const DEFAULT_RANGE: TimeRange = { kind: "preset", preset: DEFAULT_PRESET }
const PAGE_SIZES = [10, 20, 50, 100].map((size) => ({
  label: `${size} 条/页`,
  value: String(size),
}))
/** Model, key and time filters share one width so they line up. */
const FILTER_WIDTH = "w-full sm:w-44"
/** Typing in a text filter waits this long before querying. */
const TYPING_DELAY_MS = 400

const captionDate = new Intl.DateTimeFormat("zh-CN", {
  month: "short",
  day: "numeric",
})

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(id)
  }, [value, delay])
  return debounced
}

export default function UsagePage() {
  const site = useSiteStatus()
  const models = useUserModels()
  const config = site.data

  // Every filter applies as soon as it changes; no "apply" step.
  const [range, setRange] = useState<TimeRange>(DEFAULT_RANGE)
  // Bounds are fixed when the range is chosen (presets end at "now"), so the
  // query key stays stable until the range changes or the user refreshes.
  const [bounds, setBounds] = useState(() => resolveRange(DEFAULT_RANGE)!)
  const [model, setModel] = useState("")
  const [keyName, setKeyName] = useState("")
  const typedModel = useDebounced(model.trim(), TYPING_DELAY_MS)
  const keyNames = useKeyNames()
  const modelOptions = models.data ?? []
  // A pick from the model list applies at once; free text waits for typing.
  const appliedModel = modelOptions.length ? model.trim() : typedModel

  const filters = useMemo<UsageLogFilters>(
    () => ({
      ...bounds,
      type: 2,
      ...(appliedModel ? { model_name: appliedModel } : {}),
      ...(keyName ? { token_name: keyName } : {}),
    }),
    [bounds, appliedModel, keyName]
  )

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(LOGS_PAGE_SIZE)
  // Any change of filters or page size starts again from the first page.
  const filterKey = `${JSON.stringify(filters)}|${pageSize}`
  const [lastFilterKey, setLastFilterKey] = useState(filterKey)
  if (lastFilterKey !== filterKey) {
    setLastFilterKey(filterKey)
    setPage(1)
  }

  const logs = useLogs({ ...filters, p: page, page_size: pageSize })
  const stat = useUsageStat(filters)
  // No endpoint returns period token totals, so they are summed from the
  // call details themselves (all pages of the current filters).
  const totals = useLogTotals(filters)
  const sums = totals.data
  // The applied period, shown under the figures it applies to.
  const period = `${captionDate.format(bounds.start_timestamp * 1000)} — ${captionDate.format(bounds.end_timestamp * 1000)}`
  const partial = sums?.complete === false
  const { columns, visible, toggle, reset: resetColumns } = useVisibleColumns()

  const [detail, setDetail] = useState<{ log: UsageLog; open: boolean } | null>(
    null
  )
  const context: CellContext = {
    config,
    onView: (log) => setDetail({ log, open: true }),
  }

  const total = logs.data?.total ?? 0
  const pageCount = pageCountOf(total, logs.data?.page_size || pageSize)
  const fetching = logs.isFetching || stat.isFetching
  const filtered =
    Boolean(model.trim() || keyName) ||
    range.kind !== "preset" ||
    range.preset !== DEFAULT_PRESET
  const error = logs.error ?? stat.error

  function chooseRange(next: TimeRange) {
    const nextBounds = resolveRange(next)
    if (!nextBounds) return
    setRange(next)
    setBounds(nextBounds)
  }

  function refresh() {
    // Presets are re-anchored to "now"; fixed dates simply reload.
    const next = resolveRange(range)
    if (
      next &&
      (next.start_timestamp !== bounds.start_timestamp ||
        next.end_timestamp !== bounds.end_timestamp)
    ) {
      setBounds(next)
    } else {
      void logs.refetch()
      void stat.refetch()
      void totals.refetch()
    }
  }

  function resetFilters() {
    chooseRange(DEFAULT_RANGE)
    setModel("")
    setKeyName("")
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="用量记录" />

      {error && (
        <ErrorAlert
          error={error}
          onRetry={() => {
            if (logs.isError) void logs.refetch()
            if (stat.isError) void stat.refetch()
          }}
          retrying={fetching}
        />
      )}

      <div className="flex flex-col gap-3">
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <IconStatCard
            icon={WalletIcon}
            tone="slate"
            label="时段消耗额度"
            value={formatQuota(stat.data?.quota, config)}
            caption={period}
            loading={stat.isPending}
          />
          <IconStatCard
            icon={ActivityIcon}
            tone="mauve"
            label="成功请求数"
            value={
              sums ? `${formatNumber(sums.requests)}${partial ? "+" : ""}` : "—"
            }
            caption={period}
            loading={totals.isPending}
          />
          <IconStatCard
            icon={FileTextIcon}
            tone="sage"
            label="总 Token"
            value={
              sums ? formatTokens(sums.inputTokens + sums.outputTokens) : "—"
            }
            caption={
              sums
                ? `输入 ${formatTokens(sums.inputTokens)} / 输出 ${formatTokens(sums.outputTokens)}`
                : undefined
            }
            loading={totals.isPending}
          />
          <IconStatCard
            icon={DatabaseIcon}
            tone="sand"
            label="缓存 Token"
            value={sums ? formatTokens(sums.cacheReadTokens, 1) : "—"}
            caption={
              partial
                ? `仅统计前 ${formatNumber(sums?.requests)} 条`
                : "缓存读取命中"
            }
            loading={totals.isPending}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>调用明细</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* One row: filters on the left (same width), actions on the
              right; every control is h-9. */}
          <div
            role="search"
            aria-label="筛选调用明细"
            className="flex flex-wrap items-center gap-2"
          >
            <div className={FILTER_WIDTH}>
              {modelOptions.length ? (
                <Combobox
                  items={modelOptions}
                  value={model || null}
                  onValueChange={(value: string | null) =>
                    setModel(value ?? "")
                  }
                >
                  <ComboboxInput
                    aria-label="模型"
                    placeholder="全部模型"
                    className="w-full"
                    showClear={Boolean(model)}
                  />
                  <ComboboxContent>
                    <ComboboxEmpty>没有匹配的模型</ComboboxEmpty>
                    <ComboboxList>
                      {(item: string) => (
                        <ComboboxItem key={item} value={item}>
                          {item}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              ) : (
                <InputGroup>
                  <InputGroupInput
                    aria-label="模型"
                    placeholder="全部模型"
                    maxLength={200}
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                  />
                </InputGroup>
              )}
            </div>
            <div className={FILTER_WIDTH}>
              <Combobox
                items={keyNames.data ?? []}
                value={keyName || null}
                onValueChange={(value: string | null) =>
                  setKeyName(value ?? "")
                }
              >
                <ComboboxInput
                  aria-label="API 密钥"
                  placeholder="全部密钥"
                  className="w-full"
                  showClear={Boolean(keyName)}
                />
                <ComboboxContent>
                  <ComboboxEmpty>
                    {keyNames.isPending
                      ? "正在读取密钥…"
                      : keyNames.isError
                        ? "无法读取密钥列表"
                        : "没有匹配的密钥"}
                  </ComboboxEmpty>
                  <ComboboxList>
                    {(item: string) => (
                      <ComboboxItem key={item} value={item}>
                        {item}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>
            <TimeRangePicker
              value={range}
              onChange={chooseRange}
              maxDays={config?.log_max_range_days}
              className={FILTER_WIDTH}
            />
            {filtered && (
              <Button variant="ghost" onClick={resetFilters}>
                重置筛选
              </Button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" disabled={fetching} onClick={refresh}>
                <RotateCwIcon
                  data-icon="inline-start"
                  className={fetching ? "animate-spin" : undefined}
                />
                {fetching ? "更新中…" : "刷新"}
              </Button>
              <ColumnSettings
                visible={visible}
                onToggle={toggle}
                onReset={resetColumns}
              />
            </div>
          </div>

          {logs.isPending ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : logs.data?.items.length ? (
            <Table
              className={cn(
                "whitespace-nowrap transition-opacity duration-200",
                logs.isPlaceholderData && "opacity-60"
              )}
            >
              <TableHeader>
                <TableRow>
                  {columns.map((column) => (
                    <TableHead
                      key={column.id}
                      className={cn(column.align === "right" && "text-right")}
                    >
                      {column.label}
                    </TableHead>
                  ))}
                  {/* Pinned: the table scrolls sideways when many fields
                      are shown, the detail button stays reachable. */}
                  <TableHead className="sticky right-0 w-12 bg-card text-center shadow-[-12px_0_12px_-12px_var(--border)]">
                    操作
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.data.items.map((log) => (
                  <TableRow
                    key={log.id}
                    className="group/row border-0 even:bg-row-alt"
                  >
                    {columns.map((column) => (
                      <TableCell
                        key={column.id}
                        className={cn(
                          "py-3",
                          column.align === "right" && "text-right"
                        )}
                      >
                        {column.cell(log, context)}
                      </TableCell>
                    ))}
                    <TableCell className="sticky right-0 bg-card py-3 text-center shadow-[-12px_0_12px_-12px_var(--border)]">
                      {/* The pinned cell is opaque; these layers repeat the
                          row's zebra tint and hover tint on top of it. */}
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 group-even/row:bg-row-alt"
                      />
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 transition-colors duration-150 group-hover/row:bg-nav-hover"
                      />
                      <span className="relative">
                        <ViewButton log={log} onView={context.onView} />
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : logs.isSuccess ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchXIcon />
                </EmptyMedia>
                <EmptyTitle>这个范围里，还没有调用记录</EmptyTitle>
                <EmptyDescription>
                  尝试调整时间范围、模型或密钥名称，也可以稍后再来查看。
                </EmptyDescription>
              </EmptyHeader>
              {filtered && (
                <EmptyContent>
                  <Button variant="outline" onClick={resetFilters}>
                    重置筛选
                  </Button>
                </EmptyContent>
              )}
            </Empty>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ChartColumnIcon />
                </EmptyMedia>
                <EmptyTitle>暂时无法读取用量记录</EmptyTitle>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
        {total > 0 && (
          <CardFooter>
            <DataPagination
              summary={`共 ${formatNumber(total)} 条`}
              controls={
                <Select
                  items={PAGE_SIZES}
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    if (value) setPageSize(Number(value))
                  }}
                >
                  <SelectTrigger size="sm" aria-label="每页条数">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {PAGE_SIZES.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              }
              page={page}
              pageCount={pageCount}
              onPageChange={setPage}
              disabled={logs.isFetching}
            />
          </CardFooter>
        )}
      </Card>

      <LogDetailSheet
        log={detail?.log ?? null}
        open={detail?.open === true}
        onOpenChange={(open) =>
          setDetail((current) => current && { ...current, open })
        }
        onOpenChangeComplete={(open) => {
          if (!open) setDetail(null)
        }}
        config={config}
      />
    </div>
  )
}
