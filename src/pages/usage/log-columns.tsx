import { useState, type ReactNode } from "react"
import { format } from "date-fns"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  Columns3Icon,
  DatabaseIcon,
  EyeIcon,
  InfoIcon,
} from "lucide-react"
import { cn } from "cn"

import { ModelIcon } from "@/components/model-icon"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { SiteStatus, UsageLog } from "@/types/api"
import {
  formatMoney,
  formatMs,
  formatNumber,
  formatQuota,
  formatSeconds,
  formatTokens,
  formatUnitPrice,
  quotaToUsd,
} from "@/utils/format"
import {
  costBreakdown,
  durationTone,
  firstTokenMs,
  firstTokenTone,
  isWebSearch,
  outputTokensPerSecond,
  tokenBreakdown,
  type Tone,
} from "@/utils/log-other"

export interface CellContext {
  config: SiteStatus | undefined
  onView: (log: UsageLog) => void
}

export interface LogColumn {
  id: string
  label: string
  align?: "left" | "center" | "right"
  /** Shown until the user changes the column set. */
  defaultVisible: boolean
  cell: (log: UsageLog, context: CellContext) => ReactNode
}

const TONE_TEXT: Record<Tone, string> = {
  normal: "text-success-text",
  warning: "text-warning-text",
  danger: "text-destructive",
}

const BILLING_SOURCE: Record<string, string> = {
  wallet: "余额",
  subscription: "订阅",
}

export function billingSourceLabel(log: UsageLog): string | undefined {
  const source = log.other?.billing_source
  if (!source) return undefined
  const label = BILLING_SOURCE[source] ?? source
  const plan = log.other?.subscription_plan_title
  return source === "subscription" && plan ? `${label} · ${plan}` : label
}

export function formatLogTime(seconds: number): string {
  return format(seconds * 1000, "yyyy-MM-dd HH:mm:ss")
}

const muted = <span className="text-muted-foreground">—</span>

/** A small ⓘ next to a figure; hover or focus shows the breakdown. */
/** One line of a breakdown. `summary` rows close the breakdown. */
export interface DetailRow {
  label: string
  value: string
  /** accent = prices and totals of note (blue); success = amount charged. */
  tone?: "accent" | "success"
  summary?: boolean
  /** Value right after the label instead of right-aligned (single facts). */
  inline?: boolean
}

const ROW_TONE: Record<NonNullable<DetailRow["tone"]>, string> = {
  accent: "text-info-text",
  success: "text-success-text",
}

/** Label/value line shared by the tooltips and the detail sheet. */
export function DetailLine({ row }: { row: DetailRow }) {
  return (
    <div
      className={cn(
        "flex items-baseline",
        row.inline ? "gap-2" : "justify-between gap-6"
      )}
    >
      <span className="text-foreground/70">{row.label}</span>
      <span
        className={cn(
          "font-mono font-semibold whitespace-nowrap tabular-nums",
          row.tone && ROW_TONE[row.tone]
        )}
      >
        {row.value}
      </span>
    </div>
  )
}

/**
 * A small ⓘ next to a figure; hover or focus shows the breakdown. Summary
 * rows sit under a divider ("line") or in a tinted panel ("panel").
 */
function InfoTip({
  label,
  rows,
  summary = "line",
}: {
  /** Accessible name of the trigger and the tooltip's title. */
  label: string
  rows: DetailRow[]
  summary?: "line" | "panel"
}) {
  if (!rows.length) return null
  const main = rows.filter((row) => !row.summary)
  const closing = rows.filter((row) => row.summary)
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-info-text/70 outline-none hover:text-info-text focus-visible:ring-2 focus-visible:ring-ring"
          />
        }
      >
        <InfoIcon className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent
        className={cn(
          "max-w-none flex-col items-stretch gap-1 px-3.5 py-3 text-[13px] leading-snug",
          // Columns of figures need room; a single inline fact stays compact.
          rows.some((row) => !row.inline) && "min-w-60"
        )}
      >
        <div className="pb-1 font-semibold text-foreground">{label}</div>
        {main.map((row) => (
          <DetailLine key={row.label} row={row} />
        ))}
        {closing.length > 0 && (
          <div
            className={cn(
              "flex flex-col gap-1",
              summary === "line"
                ? "mt-1.5 border-t border-divider pt-2"
                : "mt-2 rounded-lg bg-foreground/[0.04] px-2.5 py-2"
            )}
          >
            {closing.map((row) => (
              <DetailLine key={row.label} row={row} />
            ))}
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

/** Token breakdown in billing terms ("Token 明细"). */
export function tokenRows(log: UsageLog): DetailRow[] {
  const tokens = tokenBreakdown(log)
  if (!tokens) return []
  return [
    { label: "普通输入 Token", value: formatTokens(tokens.normalInput) },
    { label: "输出 Token", value: formatTokens(tokens.output) },
    { label: "缓存读取 Token", value: formatTokens(tokens.cacheRead) },
    { label: "缓存写入 Token", value: formatTokens(tokens.cacheWrite) },
    // The total is shown exactly, the parts compactly.
    {
      label: "总 Token",
      value: formatNumber(tokens.total),
      tone: "accent",
      summary: true,
    },
  ]
}

/** Stated price of OpenAI web search, as published to users. */
const WEB_SEARCH_ROW: DetailRow = {
  label: "openai联网搜索",
  value: "0.01元/次",
  tone: "accent",
  inline: true,
}

/**
 * Billing breakdown ("计费明细"). Parts are reconstructed from the logged
 * ratios or the matched billing tier; 总费用 is the amount actually charged,
 * 标准费用 the same charge at the 1x group ratio.
 */
export function billingRows(
  log: UsageLog,
  config: SiteStatus | undefined
): DetailRow[] {
  // Web search is a flat per-call charge; the token breakdown does not apply.
  if (isWebSearch(log)) return [WEB_SEARCH_ROW]
  const cost = costBreakdown(log)
  const totalUsd = quotaToUsd(log.quota, config)
  const total =
    totalUsd != null
      ? formatMoney(totalUsd, config)
      : formatQuota(log.quota, config)
  const rows: DetailRow[] = []
  if (cost?.callPrice != null) {
    rows.push({
      label: "单次价格",
      value: formatMoney(cost.callPrice, config),
      tone: "accent",
    })
  } else if (cost?.inputPrice != null) {
    const price = (usd: number | undefined) => formatUnitPrice(usd, config)
    rows.push(
      { label: "输入费用", value: formatMoney(cost.inputFee, config) },
      { label: "输出费用", value: formatMoney(cost.outputFee, config) },
      { label: "输入单价", value: price(cost.inputPrice), tone: "accent" },
      { label: "输出单价", value: price(cost.outputPrice), tone: "accent" },
      { label: "缓存读取费用", value: formatMoney(cost.cacheReadFee, config) },
      { label: "缓存写入费用", value: formatMoney(cost.cacheWriteFee, config) },
      {
        label: "缓存写入单价",
        value: price(cost.cacheWritePrice),
        tone: "accent",
      }
    )
  }
  if (cost?.tierLabel) {
    rows.push({
      label: "计费档位",
      value: cost.tierLabel,
      tone: "accent",
      summary: true,
    })
  }
  if (cost?.ratio != null) {
    rows.push({
      label: "倍率",
      value: `${cost.ratio.toFixed(2)}x`,
      tone: "accent",
      summary: true,
    })
  }
  rows.push({ label: "总费用", value: total, tone: "success", summary: true })
  if (totalUsd != null && cost?.ratio != null && cost.ratio > 0) {
    rows.push({
      label: "标准费用",
      value: formatMoney(totalUsd / cost.ratio, config),
      summary: true,
    })
  }
  return rows
}

function TransportBadges({ log }: { log: UsageLog }) {
  if (isWebSearch(log)) {
    return (
      <div className="flex items-center justify-center">
        <Badge variant="warning" className="font-mono">
          SEARCH
        </Badge>
      </div>
    )
  }
  const stream = log.other?.stream_status
  const streamFailed = stream?.status === "error"
  const detail =
    stream?.end_error ?? stream?.errors?.[0] ?? stream?.end_reason ?? undefined
  return (
    <div className="flex items-center justify-center gap-1">
      {log.other?.ws && <Badge variant="neutral">WS</Badge>}
      {log.is_stream ? (
        <Badge
          variant={streamFailed ? "danger" : "success"}
          title={streamFailed && detail ? `流异常：${detail}` : undefined}
        >
          SSE
        </Badge>
      ) : (
        !log.other?.ws && <Badge variant="neutral">非流式</Badge>
      )}
    </div>
  )
}

export const LOG_COLUMNS: LogColumn[] = [
  {
    id: "token",
    label: "密钥名称",
    defaultVisible: true,
    cell: (log) =>
      log.token_name ? (
        <span className="font-medium">{log.token_name}</span>
      ) : (
        muted
      ),
  },
  {
    id: "group",
    label: "分组",
    defaultVisible: true,
    cell: (log) => {
      const source = log.other?.billing_source === "subscription"
      return log.group || source ? (
        <div className="flex items-center gap-1">
          {log.group && <Badge variant="neutral">{log.group}</Badge>}
          {source && <Badge variant="outline">订阅</Badge>}
        </div>
      ) : (
        muted
      )
    },
  },
  {
    id: "model",
    label: "模型",
    defaultVisible: true,
    cell: (log) => {
      const upstream = log.other?.is_model_mapped
        ? log.other.upstream_model_name
        : undefined
      return (
        <div className="flex items-center gap-2">
          <ModelIcon model={log.model_name} />
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[13px] font-medium">
              {log.model_name || "—"}
            </span>
            {upstream && upstream !== log.model_name && (
              <span className="font-mono text-xs text-muted-foreground">
                → {upstream}
              </span>
            )}
          </div>
        </div>
      )
    },
  },
  {
    id: "effort",
    label: "推理强度",
    align: "center",
    defaultVisible: false,
    cell: (log) =>
      log.other?.reasoning_effort ? (
        <span className="font-medium">{log.other.reasoning_effort}</span>
      ) : (
        muted
      ),
  },
  {
    id: "path",
    label: "端点",
    defaultVisible: false,
    cell: (log) =>
      log.other?.request_path ? (
        <span className="font-mono text-[13px]">{log.other.request_path}</span>
      ) : (
        muted
      ),
  },
  {
    id: "transport",
    label: "传输",
    align: "center",
    defaultVisible: true,
    cell: (log) => <TransportBadges log={log} />,
  },
  {
    id: "tokens",
    label: "Token",
    align: "right",
    defaultVisible: true,
    cell: (log) => {
      const tokens = tokenBreakdown(log)
      if (!tokens) return muted
      const read = tokens.cacheRead
      const write = tokens.cacheWrite
      return (
        <div className="flex items-center justify-end gap-1.5">
          <div className="flex flex-col items-end gap-0.5 font-mono text-[13px] tabular-nums">
            <span className="flex items-center gap-2.5">
              <span
                className="inline-flex items-center gap-0.5 text-success-text"
                title="普通输入"
              >
                <ArrowDownIcon className="size-3.5" />
                {formatTokens(tokens.normalInput)}
              </span>
              <span
                className="inline-flex items-center gap-0.5 text-info-text"
                title="输出"
              >
                <ArrowUpIcon className="size-3.5" />
                {formatTokens(tokens.output)}
              </span>
            </span>
            {(read > 0 || write > 0) && (
              <span
                className="inline-flex items-center gap-1 text-info-text"
                title="缓存读取 / 写入"
              >
                <DatabaseIcon className="size-3" />
                {read > 0 && formatTokens(read)}
                {write > 0 && ` 写 ${formatTokens(write)}`}
              </span>
            )}
          </div>
          <InfoTip label="Token 明细" rows={tokenRows(log)} />
        </div>
      )
    },
  },
  {
    id: "cost",
    label: "费用",
    align: "right",
    defaultVisible: true,
    cell: (log, { config }) => (
      <div className="flex items-center justify-end gap-1.5">
        <span className="font-mono text-[13px] font-semibold tabular-nums">
          {formatQuota(log.quota, config)}
        </span>
        <InfoTip
          label="计费明细"
          rows={billingRows(log, config)}
          summary="panel"
        />
      </div>
    ),
  },
  {
    id: "latency",
    label: "延迟",
    align: "right",
    defaultVisible: true,
    cell: (log) => {
      const ttft = firstTokenMs(log)
      if (ttft == null && log.use_time == null) return muted
      return (
        <div className="flex flex-col items-end gap-0.5 text-xs tabular-nums">
          {ttft != null && (
            <span>
              <span className="text-muted-foreground">TTFT </span>
              <span
                className={cn(
                  "font-mono text-[13px] font-semibold",
                  TONE_TEXT[firstTokenTone(ttft)]
                )}
              >
                {formatMs(ttft)}
              </span>
            </span>
          )}
          {log.use_time != null && (
            <span>
              <span className="text-muted-foreground">总耗时 </span>
              <span
                className={cn(
                  "font-mono text-[13px] font-semibold",
                  TONE_TEXT[durationTone(log)]
                )}
              >
                {formatSeconds(log.use_time)}
              </span>
            </span>
          )}
        </div>
      )
    },
  },
  {
    id: "speed",
    label: "速率",
    align: "right",
    defaultVisible: false,
    cell: (log) => {
      const tps = outputTokensPerSecond(log)
      return tps == null ? (
        muted
      ) : (
        <span className="font-mono text-[13px] font-semibold tabular-nums">
          {formatTokens(tps)}
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            tok/s
          </span>
        </span>
      )
    },
  },
  {
    id: "time",
    label: "时间",
    defaultVisible: true,
    cell: (log) => (
      <span className="font-mono text-[13px] tabular-nums">
        {formatLogTime(log.created_at)}
      </span>
    ),
  },
  {
    id: "ip",
    label: "IP",
    // Only recorded when the user turned on IP logging, so usually empty.
    defaultVisible: false,
    cell: (log) =>
      log.ip ? (
        <Badge variant="neutral" className="font-mono">
          {log.ip}
        </Badge>
      ) : (
        muted
      ),
  },
  {
    id: "request",
    label: "请求 ID",
    defaultVisible: false,
    cell: (log) =>
      log.request_id ? (
        <span
          className="block max-w-44 truncate font-mono text-xs text-muted-foreground"
          title={log.request_id}
        >
          {log.request_id}
        </span>
      ) : (
        muted
      ),
  },
]

/** Fixed last column; not part of the column settings. */
export function ViewButton({
  log,
  onView,
}: {
  log: UsageLog
  onView: (log: UsageLog) => void
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground"
      aria-label={`查看 ${formatLogTime(log.created_at)} 的调用详情`}
      onClick={() => onView(log)}
    >
      <EyeIcon />
    </Button>
  )
}

// Versioned: a new default column set should reach people who had saved one.
const STORAGE_KEY = "api-console-usage-columns-v2"
const DEFAULT_VISIBLE = LOG_COLUMNS.filter((c) => c.defaultVisible).map(
  (c) => c.id
)

function readStoredColumns(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (Array.isArray(parsed)) {
      const known = new Set(LOG_COLUMNS.map((c) => c.id))
      const ids = parsed.filter(
        (id): id is string => typeof id === "string" && known.has(id)
      )
      if (ids.length) return ids
    }
  } catch {
    // Unavailable or malformed storage: fall back to the defaults.
  }
  return DEFAULT_VISIBLE
}

/** Which columns are shown; remembered in this browser. */
export function useVisibleColumns() {
  const [visible, setVisible] = useState<string[]>(readStoredColumns)

  function update(next: string[]) {
    setVisible(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Not persisted; the choice still applies for this visit.
    }
  }

  return {
    columns: LOG_COLUMNS.filter((column) => visible.includes(column.id)),
    visible,
    toggle: (id: string, on: boolean) =>
      update(on ? [...visible, id] : visible.filter((value) => value !== id)),
    reset: () => update(DEFAULT_VISIBLE),
  }
}

export function ColumnSettings({
  visible,
  onToggle,
  onReset,
}: {
  visible: string[]
  onToggle: (id: string, on: boolean) => void
  onReset: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        <Columns3Icon data-icon="inline-start" />
        显示字段
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>显示字段</DropdownMenuLabel>
          {LOG_COLUMNS.map((column) => {
            const checked = visible.includes(column.id)
            return (
              <DropdownMenuCheckboxItem
                key={column.id}
                checked={checked}
                // Keep at least one data column.
                disabled={checked && visible.length === 1}
                closeOnClick={false}
                onCheckedChange={(on) => onToggle(column.id, on)}
              >
                {column.label}
              </DropdownMenuCheckboxItem>
            )
          })}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onReset}>恢复默认</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
