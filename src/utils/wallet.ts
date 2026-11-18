import type { DateRange, ModelApiToken, SiteStatus } from '@/types/api'
import { formatMoney, formatQuota, quotaDisplay, quotaToUsd } from './format'

/** Days covered by the "recent" spend: a week, or less when the server's log range limit is shorter. */
export function recentDays(maxRangeDays: number | undefined): number {
  if (!maxRangeDays || maxRangeDays <= 0) return 7
  return Math.max(1, Math.min(7, Math.floor(maxRangeDays)))
}

/** Average spend per day over a range (today counts by the part elapsed). */
export function dailyAverage(quota: number, range: DateRange): number {
  const days = Math.max(1 / 24, (range.end_timestamp - range.start_timestamp) / 86_400)
  return quota / days
}

/** How long the balance lasts at the daily average spend, as display text. */
export function runwayText(balance: number | undefined, perDay: number | undefined): string {
  if (balance === undefined || perDay === undefined) return '—'
  if (balance <= 0) return '余额已用尽'
  if (perDay <= 0) return '近期无消费'
  const days = balance / perDay
  if (days < 1) return '不足 1 天'
  if (days > 365) return '超过 1 年'
  return `约 ${Math.floor(days)} 天`
}

/**
 * Small quota amounts (e.g. per request) with up to 4 decimals instead of
 * the fixed 3, in the site's display currency; raw quota stays whole.
 */
export function formatQuotaPrecise(raw: number | null | undefined, config?: SiteStatus): string {
  if (quotaDisplay(raw, config).unit === 'quota') return formatQuota(raw, config)
  return formatMoney(quotaToUsd(raw, config), config)
}

export interface KeySpend {
  token: ModelApiToken
  used: number
  /** Share of all keys' spend, 0–1. */
  share: number
}

/** Keys ordered by what they have spent, largest first; never-used keys last. */
export function keySpend(tokens: ModelApiToken[]): { items: KeySpend[]; total: number } {
  const total = tokens.reduce((sum, token) => sum + Math.max(0, token.used_quota ?? 0), 0)
  const items = tokens
    .map((token) => {
      const used = Math.max(0, token.used_quota ?? 0)
      return { token, used, share: total > 0 ? used / total : 0 }
    })
    .sort((a, b) => b.used - a.used || a.token.name.localeCompare(b.token.name, 'zh-CN'))
  return { items, total }
}
