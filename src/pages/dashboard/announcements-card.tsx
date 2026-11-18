import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { ChevronDownIcon, MegaphoneIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

import {
  Card,
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
import { cn } from "@/lib/utils"
import type { Announcement, SiteStatus } from "@/types/api"

/** The upstream console's announcement types; anything else reads "通知". */
const TYPES: Record<string, { label: string; dot: string }> = {
  default: { label: "通知", dot: "bg-muted-foreground/50" },
  ongoing: { label: "进行中", dot: "bg-info-text" },
  success: { label: "已完成", dot: "bg-success" },
  warning: { label: "注意", dot: "bg-warning" },
  error: { label: "重要", dot: "bg-destructive" },
}

function typeOf(item: Announcement) {
  return TYPES[item.type ?? ""] ?? TYPES.default
}

const dateFormat = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

function publishTime(item: Announcement): number | null {
  if (!item.publishDate) return null
  const time = new Date(item.publishDate).getTime()
  return Number.isFinite(time) ? time : null
}

/**
 * Announcements are Markdown (sometimes HTML) in the admin console. They are
 * shown as plain text — never injected as HTML — with the markup stripped.
 */
function plainText(content: string): string {
  return content
    .replace(/<[^>]*>/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1（$2）")
    .replace(/^\s{0,3}(?:#{1,6}|>)\s?/gm, "")
    .replace(/(\*\*|__|`)/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/**
 * One announcement, shown in full up to 5 lines. Longer text folds and gets
 * an inline 展开/收起 toggle — short notices never need a click.
 */
function AnnouncementItem({ item }: { item: Announcement }) {
  const type = typeOf(item)
  const time = publishTime(item)
  const text = plainText(item.content)
  const textRef = useRef<HTMLParagraphElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)

  // Measure while clamped; re-measure when the card width changes.
  useLayoutEffect(() => {
    const el = textRef.current
    if (!el || expanded) return
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [text, expanded])

  return (
    <li className="flex items-start gap-3 py-3">
      <span
        aria-hidden="true"
        className={cn("mt-1.5 size-2 shrink-0 rounded-full", type.dot)}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p
          ref={textRef}
          className={cn(
            "font-medium break-words whitespace-pre-line",
            !expanded && "line-clamp-5"
          )}
        >
          <span className="sr-only">{type.label}：</span>
          {text}
        </p>
        {(overflows || expanded) && (
          <Button
            variant="link"
            size="xs"
            className="-ml-2 self-start"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "收起" : "展开全文"}
            <ChevronDownIcon
              data-icon="inline-end"
              className={cn("transition-transform", expanded && "rotate-180")}
            />
          </Button>
        )}
        {(time !== null || item.extra) && (
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {time !== null && (
              <time className="shrink-0 tabular-nums">
                {dateFormat.format(time)}
              </time>
            )}
            {item.extra && (
              <span className="break-words">{plainText(item.extra)}</span>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

export function AnnouncementsCard({
  config,
  loading,
}: {
  config: SiteStatus | undefined
  loading: boolean
}) {
  const items = useMemo(() => {
    if (config?.announcements_enabled === false) return []
    // Newest first; undated entries keep their configured order at the end.
    return (config?.announcements ?? [])
      .map((item, index) => ({ item, index, time: publishTime(item) }))
      .sort(
        (a, b) =>
          (b.time ?? -Infinity) - (a.time ?? -Infinity) || a.index - b.index
      )
      .map(({ item }) => item)
  }, [config])

  return (
    <Card>
      <CardHeader>
        <CardTitle>公告</CardTitle>
        <CardDescription>平台最新动态与通知。</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : items.length ? (
          <ul className="flex flex-col divide-y divide-border">
            {items.map((item, index) => (
              <AnnouncementItem key={item.id ?? index} item={item} />
            ))}
          </ul>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MegaphoneIcon />
              </EmptyMedia>
              <EmptyTitle>暂无公告</EmptyTitle>
              <EmptyDescription>平台发布公告后会显示在这里。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  )
}
