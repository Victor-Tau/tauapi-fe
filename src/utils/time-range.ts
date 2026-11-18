import type { DateRange } from '@/types/api'
import { getDateRange } from './format'
import { localDateBounds, localDateKey } from './usage'

export type TimePreset = 'today' | 'yesterday' | '24h' | '7d' | '14d' | '30d' | 'month' | 'lastMonth'

export const TIME_PRESETS: ReadonlyArray<{ key: TimePreset; label: string }> = [
  { key: 'today', label: '今天' },
  { key: 'yesterday', label: '昨天' },
  { key: '24h', label: '近 24 小时' },
  { key: '7d', label: '近 7 天' },
  { key: '14d', label: '近 14 天' },
  { key: '30d', label: '近 30 天' },
  { key: 'month', label: '本月' },
  { key: 'lastMonth', label: '上月' },
]

/** A chosen period: a preset (re-resolved against "now" on refresh) or fixed dates. */
export type TimeRange =
  | { kind: 'preset'; preset: TimePreset }
  | { kind: 'custom'; start: string; end: string }

const toSeconds = (date: Date) => Math.floor(date.getTime() / 1000)

function startOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

/** Unix-second bounds of a preset in the browser's local timezone. */
export function resolvePreset(preset: TimePreset, now = new Date()): DateRange {
  const end = toSeconds(now)
  switch (preset) {
    case 'today':
      return { start_timestamp: toSeconds(startOfDay(now)), end_timestamp: end }
    case 'yesterday': {
      const today = startOfDay(now)
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      return { start_timestamp: toSeconds(yesterday), end_timestamp: toSeconds(today) - 1 }
    }
    case '24h':
      return { start_timestamp: end - 86_400, end_timestamp: end }
    case '7d':
      return getDateRange(7, now)
    case '14d':
      return getDateRange(14, now)
    case '30d':
      return getDateRange(30, now)
    case 'month':
      return { start_timestamp: toSeconds(new Date(now.getFullYear(), now.getMonth(), 1)), end_timestamp: end }
    case 'lastMonth': {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const nextFirst = new Date(now.getFullYear(), now.getMonth(), 1)
      return { start_timestamp: toSeconds(first), end_timestamp: toSeconds(nextFirst) - 1 }
    }
  }
}

/** Bounds of a range, or null when custom dates are invalid. */
export function resolveRange(range: TimeRange, now = new Date()): DateRange | null {
  return range.kind === 'preset' ? resolvePreset(range.preset, now) : localDateBounds(range.start, range.end)
}

/**
 * Same rule as the server (controller/log.go limitLogTimeRange): the span from
 * the start to min(end, now) may not exceed the configured number of days.
 */
export function exceedsMaxRange(range: DateRange, maxDays: number | undefined, now = new Date()): boolean {
  if (!maxDays || maxDays <= 0) return false
  const end = Math.min(range.end_timestamp, toSeconds(now))
  return end - range.start_timestamp > maxDays * 86_400
}

export function maxRangeMessage(maxDays: number): string {
  return `最大查询范围为 ${maxDays} 天，请缩小时间范围。`
}

const shortDate = new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' })

export function timeRangeLabel(range: TimeRange): string {
  if (range.kind === 'preset') return TIME_PRESETS.find((item) => item.key === range.preset)?.label ?? ''
  const bounds = localDateBounds(range.start, range.end)
  if (!bounds) return '自定义'
  const start = shortDate.format(bounds.start_timestamp * 1000)
  const end = shortDate.format(bounds.end_timestamp * 1000)
  return start === end ? start : `${start} – ${end}`
}

/** The custom date fields start from the currently applied period. */
export function rangeToDateKeys(range: DateRange): { start: string; end: string } {
  return {
    start: localDateKey(new Date(range.start_timestamp * 1000)),
    end: localDateKey(new Date(range.end_timestamp * 1000)),
  }
}
