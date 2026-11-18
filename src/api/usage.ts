import { apiClient } from './request'
import { z } from 'zod'
import { logSchema, pageSchema, parseData, quotaDataSchema, statSchema } from './schema'
import { queryString, validateFilters } from './shared'
import type { DateRange, UsageLog, UsageLogFilters } from '@/types/api'
import { tokenBreakdown } from '@/utils/log-other'
import { localDateKey } from '@/utils/usage'

export async function listOwnLogs(filters: UsageLogFilters = {}, signal?: AbortSignal) {
  const params = validateFilters({ type: 2, ...filters })
  return parseData(pageSchema(logSchema), await apiClient.request(`/api/log/self${queryString({ ...params, p: params.p ?? 1 })}`, { signal }), '用量记录')
}

/**
 * Balance-moving records of every type (type 0 = no filter). Without a start
 * the server returns its maximum log range (`log_max_range_days`) up to now.
 */
export async function listBalanceLogs(filters: { p: number; page_size: number; type: number }, signal?: AbortSignal) {
  return listOwnLogs({ ...filters }, signal)
}

export async function getOwnUsageStat(filters: UsageLogFilters = {}, signal?: AbortSignal) {
  const { p, page_size, ...params } = validateFilters({ type: 2, ...filters })
  void p
  void page_size
  return parseData(statSchema, await apiClient.request(`/api/log/self/stat${queryString(params)}`, { signal }), '用量统计')
}

/** Totals of the call details in a period (the server has no endpoint for them). */
export interface LogTotals {
  requests: number
  /** All input: uncached + cache reads + cache writes. */
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  /** False when the safety limit stopped paging before the last record. */
  complete: boolean
}

/** The server caps `page_size` at 100. */
const TOTALS_PAGE_SIZE = 100
/** Pages fetched in parallel. */
const TOTALS_CONCURRENCY = 4
/** Safety limit: 300 pages = 30,000 records. */
const TOTALS_MAX_PAGES = 300

/**
 * Visits every call detail matching the filters by paging through
 * /api/log/self. The list's `total` is capped server-side (10,000), so paging
 * continues until a short page rather than trusting it. Returns false when the
 * safety limit stopped paging before the last record.
 */
async function scanOwnLogs(filters: UsageLogFilters, visit: (log: UsageLog) => void, signal?: AbortSignal): Promise<boolean> {
  for (let first = 1; first <= TOTALS_MAX_PAGES; first += TOTALS_CONCURRENCY) {
    const pages = Array.from({ length: Math.min(TOTALS_CONCURRENCY, TOTALS_MAX_PAGES - first + 1) }, (_, i) => first + i)
    const results = await Promise.all(pages.map((p) => listOwnLogs({ ...filters, p, page_size: TOTALS_PAGE_SIZE }, signal)))
    for (const result of results) result.items.forEach(visit)
    if (results.some((result) => result.items.length < TOTALS_PAGE_SIZE)) return true
  }
  return false
}

/** Sums tokens over every call detail matching the filters. */
export async function sumOwnLogs(filters: UsageLogFilters, signal?: AbortSignal): Promise<LogTotals> {
  const totals: LogTotals = { requests: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, complete: false }
  totals.complete = await scanOwnLogs(filters, (log) => {
    totals.requests++
    const tokens = tokenBreakdown(log)
    if (!tokens) return
    totals.inputTokens += tokens.normalInput + tokens.cacheRead + tokens.cacheWrite
    totals.outputTokens += tokens.output
    totals.cacheReadTokens += tokens.cacheRead
  }, signal)
  return totals
}

export type TrendUnit = 'hour' | 'day'

/** One time bucket of the token trend. */
export interface TokenTrendBucket {
  /** Local start of the hour/day, Unix seconds. */
  start: number
  requests: number
  /** All input: uncached + cache reads + cache writes. */
  input: number
  output: number
  cacheRead: number
}

export interface TokenTrend {
  unit: TrendUnit
  buckets: TokenTrendBucket[]
  /** False when the safety limit stopped paging before the last record. */
  complete: boolean
}

function bucketStart(date: Date, unit: TrendUnit): Date {
  const copy = new Date(date)
  if (unit === 'hour') copy.setMinutes(0, 0, 0)
  else copy.setHours(0, 0, 0, 0)
  return copy
}

/**
 * Input/output/cache tokens per local hour or day. /api/data/self only has
 * input+output combined, so the trend is built from the call details.
 * Every bucket of the range is present; empty ones are real zeroes.
 */
export async function getOwnTokenTrend(range: DateRange, unit: TrendUnit, signal?: AbortSignal): Promise<TokenTrend> {
  const buckets: TokenTrendBucket[] = []
  const index = new Map<number, TokenTrendBucket>()
  const end = new Date(range.end_timestamp * 1000)
  for (const at = bucketStart(new Date(range.start_timestamp * 1000), unit); at <= end;) {
    const bucket = { start: Math.floor(at.getTime() / 1000), requests: 0, input: 0, output: 0, cacheRead: 0 }
    buckets.push(bucket)
    index.set(bucket.start, bucket)
    if (unit === 'hour') at.setHours(at.getHours() + 1)
    else at.setDate(at.getDate() + 1)
  }
  const complete = await scanOwnLogs({ ...range, type: 2 }, (log) => {
    const bucket = index.get(Math.floor(bucketStart(new Date(log.created_at * 1000), unit).getTime() / 1000))
    if (!bucket) return
    bucket.requests++
    const tokens = tokenBreakdown(log)
    if (!tokens) return
    bucket.input += tokens.normalInput + tokens.cacheRead + tokens.cacheWrite
    bucket.output += tokens.output
    bucket.cacheRead += tokens.cacheRead
  }, signal)
  return { unit, buckets, complete }
}

/** Windows fetched in parallel. */
const DAILY_CONCURRENCY = 4

/**
 * Tokens per local day (`YYYY-MM-DD` → tokens) from `start_timestamp` to now,
 * from /api/data/self. The server rejects spans longer than
 * `log_max_range_days`, so the range is fetched in windows of that size.
 * `token_used` is the server's own count (prompt + completion tokens).
 */
export async function getOwnDailyTokens(startTimestamp: number, maxRangeDays: number | undefined, signal?: AbortSignal): Promise<Map<string, number>> {
  const now = Math.floor(Date.now() / 1000)
  const span = (maxRangeDays && maxRangeDays > 0 ? Math.floor(maxRangeDays) : 30) * 86_400
  const windows: { start: number; end: number }[] = []
  for (let start = startTimestamp; start <= now; start += span) {
    windows.push({ start, end: Math.min(start + span - 1, now) })
  }
  const schema = z.array(quotaDataSchema).nullable().transform((rows) => rows ?? [])
  const days = new Map<string, number>()
  for (let first = 0; first < windows.length; first += DAILY_CONCURRENCY) {
    const batch = windows.slice(first, first + DAILY_CONCURRENCY)
    const results = await Promise.all(batch.map(async ({ start, end }) =>
      parseData(schema, await apiClient.request(`/api/data/self${queryString({ start_timestamp: start, end_timestamp: end })}`, { signal }), 'Token 活动')))
    for (const rows of results) {
      for (const row of rows) {
        if (row.created_at < startTimestamp || row.created_at > now) continue
        const key = localDateKey(new Date(row.created_at * 1000))
        days.set(key, (days.get(key) ?? 0) + row.token_used)
      }
    }
  }
  return days
}
