import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"

export function pageCountOf(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / Math.max(1, pageSize)))
}

export function DataPagination({
  summary,
  page,
  pageCount,
  onPageChange,
  disabled = false,
  controls,
}: {
  summary: ReactNode
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  disabled?: boolean
  /** Extra controls (e.g. page size) placed just before "上一页". */
  controls?: ReactNode
}) {
  return (
    <div className="flex w-full items-center justify-between gap-2 text-sm text-muted-foreground">
      <span className="shrink-0 tabular-nums">{summary}</span>
      <nav aria-label="分页" className="flex items-center gap-1.5 sm:gap-2">
        {controls}
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeftIcon data-icon="inline-start" />
          上一页
        </Button>
        <span className="min-w-12 text-center sm:min-w-16 text-foreground tabular-nums">
          {page} / {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          下一页
          <ChevronRightIcon data-icon="inline-end" />
        </Button>
      </nav>
    </div>
  )
}
