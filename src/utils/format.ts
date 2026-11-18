import type { DateRange, SiteStatus } from '@/types/api'
import { ApiError } from '@/api/errors'

/** Every displayed number keeps exactly 3 decimal places. */
export const DECIMALS = 3
const SMALLEST = 10 ** -DECIMALS

const fixed = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: DECIMALS,
  maximumFractionDigits: DECIMALS,
})
const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** Fixed 3 decimals; non-zero magnitudes below 0.001 read "<0.001" instead of "0.000". */
export function formatDecimal(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (value !== 0 && Math.abs(value) < SMALLEST) return `${value < 0 ? '−' : ''}<${fixed.format(SMALLEST)}`
  return fixed.format(value)
}

/** Integers (counts) stay whole; anything fractional is shown with 3 decimals. */
export function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return Number.isInteger(value) ? whole.format(value) : formatDecimal(value)
}

/** Token figures keep 2 decimals (other numbers keep 3). */
const tokenFixed = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Token amounts and rates, 2 decimals: from 1000 on in K (66,538 → 66.54K),
 * from a million on in M (875,512,000 → 875.51M), from a billion on in B
 * (5,842,440,000 → 5.84B).
 */
export function formatTokens(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (Math.abs(value) >= 1_000_000_000) return `${tokenFixed.format(value / 1_000_000_000)}B`
  if (Math.abs(value) >= 1_000_000) return `${tokenFixed.format(value / 1_000_000)}M`
  if (Math.abs(value) >= 1000) return `${tokenFixed.format(value / 1000)}K`
  return Number.isInteger(value) ? whole.format(value) : tokenFixed.format(value)
}

export interface QuotaDisplay {
  value: string
  unit: string
}

/** Conversion is based only on confirmed status settings; never use recharge price. */
export function quotaDisplay(raw: number | null | undefined, config?: SiteStatus): QuotaDisplay {
  let unit = 'quota'
  let divisor = 1
  let rate = 1
  if (config?.quota_per_unit && config.quota_per_unit > 0) {
    switch (config.quota_display_type) {
      case 'USD': unit = 'USD'; divisor = config.quota_per_unit; break
      case 'CNY':
        if (config.usd_exchange_rate && config.usd_exchange_rate > 0) {
          unit = 'CNY'; divisor = config.quota_per_unit; rate = config.usd_exchange_rate
        }
        break
      case 'CUSTOM':
        if (config.custom_currency_symbol && config.custom_currency_exchange_rate && config.custom_currency_exchange_rate > 0) {
          unit = config.custom_currency_symbol; divisor = config.quota_per_unit; rate = config.custom_currency_exchange_rate
        }
        break
      // The server may call this TOKENS, but quota is not actual model token usage.
      case 'TOKENS': unit = 'quota'; break
    }
  }
  if (raw == null || !Number.isFinite(raw)) return { value: '—', unit }
  const value = raw / divisor * rate
  // Raw quota is an integer amount; currencies always carry 3 decimals.
  return { value: unit === 'quota' ? formatNumber(value) : formatDecimal(value), unit }
}

export function formatQuota(raw: number | null | undefined, config?: SiteStatus): string {
  const { value, unit } = quotaDisplay(raw, config)
  if (value === '—') return value
  if (unit === 'USD') return `$${value}`
  if (unit === 'CNY') return `¥${value}`
  if (unit === 'quota') return `${value} quota`
  return `${unit} ${value}`
}

export function formatUnixSeconds(seconds: number | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '—'
  const date = new Date(seconds * 1000)
  if (!Number.isFinite(date.getTime())) return '—'
  return new Intl.DateTimeFormat('zh-CN', options ?? {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date)
}

/** Calendar days in the browser's local timezone, converted to Unix seconds. */
export function getDateRange(days: number, now = new Date()): DateRange {
  if (!Number.isInteger(days) || days < 1 || days > 366) throw new Error('日期范围无效')
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - days + 1)
  return { start_timestamp: Math.floor(start.getTime() / 1000), end_timestamp: Math.floor(now.getTime() / 1000) }
}

export function toRelayKey(raw: string): string {
  const key = raw.trim().replace(/^(?:sk-)+/, '')
  if (!key || /[\s*•]/.test(key)) throw new ApiError('服务器未返回有效的完整密钥。', 200, 'INVALID_RELAY_KEY')
  return `sk-${key}`
}

/** Latency in milliseconds: "525 ms" below a second, "2.960 s" above. */
export function formatMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—'
  return ms < 1000 ? `${whole.format(Math.round(ms))} ms` : `${formatNumber(ms / 1000)} s`
}

/** Durations in seconds: "17 s" below a minute, "1.600 min" above. */
export function formatSeconds(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—'
  return seconds < 60 ? `${formatNumber(seconds)} s` : `${formatNumber(seconds / 60)} min`
}

/**
 * The site's display currency for USD amounts (prices are USD natively):
 * same rules as quotaDisplay, falling back to USD when quota is shown raw.
 */
function displayCurrency(config?: SiteStatus): { prefix: string; rate: number } {
  switch (config?.quota_display_type) {
    case 'CNY':
      if (config.usd_exchange_rate && config.usd_exchange_rate > 0) return { prefix: '¥', rate: config.usd_exchange_rate }
      break
    case 'CUSTOM':
      if (config.custom_currency_symbol && config.custom_currency_exchange_rate && config.custom_currency_exchange_rate > 0) {
        return { prefix: `${config.custom_currency_symbol} `, rate: config.custom_currency_exchange_rate }
      }
      break
  }
  return { prefix: '$', rate: 1 }
}

/** Quota units to USD; null when the site gives no conversion. */
export function quotaToUsd(quota: number | null | undefined, config?: SiteStatus): number | null {
  if (quota == null || !Number.isFinite(quota) || !config?.quota_per_unit || config.quota_per_unit <= 0) return null
  return quota / config.quota_per_unit
}

/**
 * Small money amounts in billing breakdowns: up to 4 decimals, trailing
 * zeros dropped ("$0.0003", "$2.5", "$0"); below 0.0001 reads "<$0.0001".
 */
export function formatMoney(usd: number | null | undefined, config?: SiteStatus, maxDigits = 4): string {
  if (usd == null || !Number.isFinite(usd)) return '—'
  const { prefix, rate } = displayCurrency(config)
  const value = usd * rate
  const smallest = 10 ** -maxDigits
  if (value !== 0 && Math.abs(value) < smallest) return `${value < 0 ? '−' : ''}<${prefix}${smallest.toFixed(maxDigits)}`
  return `${prefix}${new Intl.NumberFormat('en-US', { maximumFractionDigits: maxDigits }).format(value)}`
}

/** A per-million-token price: "$2 / 1M Token". */
export function formatUnitPrice(usdPerMillion: number | null | undefined, config?: SiteStatus): string {
  return usdPerMillion == null ? '—' : `${formatMoney(usdPerMillion, config)} / 1M Token`
}
