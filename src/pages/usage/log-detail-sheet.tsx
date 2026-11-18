import type { ReactNode } from "react"
import { cn } from "cn"

import { ModelIcon } from "@/components/model-icon"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { SiteStatus, UsageLog } from "@/types/api"
import { formatMs, formatSeconds, formatTokens } from "@/utils/format"
import { firstTokenMs, outputTokensPerSecond } from "@/utils/log-other"

import {
  billingRows,
  billingSourceLabel,
  type DetailRow,
  formatLogTime,
  tokenRows,
} from "./log-columns"

type Row = [string, ReactNode]

const TONE_TEXT = { accent: "text-info-text", success: "text-success-text" }

/** Breakdown rows keep their colour coding in the sheet. */
function toRow(row: DetailRow): Row {
  return [
    row.label,
    <span className={cn("font-mono", row.tone && TONE_TEXT[row.tone])}>
      {row.value}
    </span>,
  ]
}

function Section({ title, rows }: { title: string; rows: Row[] }) {
  const shown = rows.filter(([, value]) => value != null && value !== "")
  if (!shown.length) return null
  return (
    <section className="flex flex-col gap-1">
      <h3 className="pb-1 font-medium">{title}</h3>
      <dl className="flex flex-col">
        {shown.map(([label, value], index) => (
          <div key={label}>
            {index > 0 && <Separator />}
            <div className="flex items-start justify-between gap-4 py-2.5">
              <dt className="shrink-0 text-muted-foreground">{label}</dt>
              <dd className="min-w-0 text-right font-medium break-all tabular-nums">
                {value}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  )
}

function transportLabel(log: UsageLog): string {
  const parts = []
  if (log.other?.ws) parts.push("WebSocket")
  parts.push(log.is_stream ? "流式（SSE）" : "非流式")
  return parts.join(" · ")
}

const STREAM_STATUS: Record<string, string> = { ok: "正常结束", error: "异常" }

export function LogDetailSheet({
  log,
  open,
  onOpenChange,
  onOpenChangeComplete,
  config,
}: {
  log: UsageLog | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenChangeComplete: (open: boolean) => void
  config: SiteStatus | undefined
}) {
  const other = log?.other ?? {}
  const ttft = log ? firstTokenMs(log) : null
  const tps = log ? outputTokensPerSecond(log) : null
  const stream = other.stream_status

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={onOpenChangeComplete}
    >
      <SheetContent className="overflow-y-auto sm:max-w-[440px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-mono break-all">
            <ModelIcon model={log?.model_name} className="size-5" />
            {log?.model_name || "调用详情"}
          </SheetTitle>
          <SheetDescription className="tabular-nums">
            {log ? formatLogTime(log.created_at) : null}
          </SheetDescription>
        </SheetHeader>
        {log && (
          <div className="flex flex-col gap-6 px-5 pb-6">
            <Section
              title="请求"
              rows={[
                [
                  "请求 ID",
                  log.request_id && (
                    <span className="font-mono text-xs select-all">
                      {log.request_id}
                    </span>
                  ),
                ],
                ["密钥名称", log.token_name],
                ["分组", log.group],
                [
                  "上游模型",
                  other.is_model_mapped ? other.upstream_model_name : undefined,
                ],
                ["推理强度", other.reasoning_effort],
                [
                  "端点",
                  other.request_path && (
                    <span className="font-mono">{other.request_path}</span>
                  ),
                ],
                ["传输", transportLabel(log)],
                ["IP", log.ip && <span className="font-mono">{log.ip}</span>],
              ]}
            />
            <Section title="Token 明细" rows={tokenRows(log).map(toRow)} />
            <Section
              title="计费明细"
              rows={[
                ...billingRows(log, config).map(toRow),
                ["扣费来源", billingSourceLabel(log)],
              ]}
            />
            <Section
              title="性能"
              rows={[
                ["首字时间（TTFT）", ttft != null ? formatMs(ttft) : undefined],
                [
                  "总耗时",
                  log.use_time != null
                    ? formatSeconds(log.use_time)
                    : undefined,
                ],
                [
                  "输出速率",
                  tps != null ? `${formatTokens(tps)} tok/s` : undefined,
                ],
                [
                  "流状态",
                  stream?.status
                    ? (STREAM_STATUS[stream.status] ?? stream.status)
                    : undefined,
                ],
                ["结束原因", stream?.end_reason],
                [
                  "流错误",
                  stream?.end_error ??
                    (stream?.errors?.length
                      ? stream.errors.join("；")
                      : undefined),
                ],
              ]}
            />
            {log.content && (
              <section className="flex flex-col gap-2">
                <h3 className="font-medium">说明</h3>
                <p className="rounded-lg bg-muted/50 p-3 text-xs break-all whitespace-pre-wrap text-muted-foreground">
                  {log.content}
                </p>
              </section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
