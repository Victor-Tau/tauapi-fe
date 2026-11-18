import type { UsageLog } from '@/types/api'
import { parseBillingExpr, tierConditionText, type PriceTier } from './pricing'

/**
 * The user-visible part of a log's `other` metadata (the server strips the
 * admin/root/audit sections before sending it). Every field is optional and
 * type-checked on read: older deployments omit most of them.
 */
export interface LogOther {
  /** Time to first token, in milliseconds. */
  frt?: number
  ws?: boolean
  reasoning_effort?: string
  request_path?: string
  is_model_mapped?: boolean
  upstream_model_name?: string
  cache_tokens?: number
  cache_creation_tokens?: number
  cache_creation_tokens_5m?: number
  cache_creation_tokens_1h?: number
  cache_creation_tokens_12h?: number
  /** Normalised cache-write total written by newer servers. */
  cache_write_tokens?: number
  cache_creation_ratio?: number
  cache_creation_ratio_5m?: number
  cache_creation_ratio_1h?: number
  cache_creation_ratio_12h?: number
  /** "anthropic": prompt_tokens already excludes cached input. */
  usage_semantic?: string
  /** Final upstream request was Claude Messages (same input semantics). */
  claude?: boolean
  /** "tiered_expr": priced by the billing expression in `expr_b64`. */
  billing_mode?: string
  expr_b64?: string
  /** Name of the expression tier that applied, e.g. "0_500k". */
  matched_tier?: string
  /** "token" or a per-request unit. */
  billing_unit?: string
  fixed_price?: number
  /** Token counts the tiered charge was computed on (billing-normalised). */
  billing_tokens?: Partial<Record<'p' | 'c' | 'cr' | 'cc' | 'cc1h' | 'cc12h', number>>
  model_ratio?: number
  completion_ratio?: number
  cache_ratio?: number
  group_ratio?: number
  user_group_ratio?: number
  /** Per-call price; a value ≤ 0 means token-ratio billing. */
  model_price?: number
  billing_source?: string
  subscription_plan_title?: string
  /** Structured content (key + params) of top-up/system logs. */
  content_parts?: LogMessage[]
  /** Operation descriptor of admin actions, e.g. user.quota_add. */
  op?: LogMessage
  stream_status?: {
    status?: string
    end_reason?: string
    end_error?: string
    error_count?: number
    errors?: string[]
  }
}

export interface LogMessage {
  key: string
  params: Record<string, unknown>
}

function logMessage(value: unknown, keyName: 'key' | 'action'): LogMessage | null {
  if (!isRecord(value) || typeof value[keyName] !== 'string') return null
  return { key: value[keyName] as string, params: isRecord(value.params) ? value.params : {} }
}

const NUMBER_KEYS = [
  'frt', 'cache_tokens', 'cache_creation_tokens', 'cache_creation_tokens_5m', 'cache_creation_tokens_1h',
  'cache_creation_tokens_12h', 'cache_write_tokens', 'cache_creation_ratio', 'cache_creation_ratio_5m',
  'cache_creation_ratio_1h', 'cache_creation_ratio_12h', 'fixed_price',
  'model_ratio', 'completion_ratio', 'cache_ratio', 'group_ratio', 'user_group_ratio', 'model_price',
] as const
const STRING_KEYS = [
  'reasoning_effort', 'request_path', 'upstream_model_name', 'billing_source', 'subscription_plan_title',
  'usage_semantic', 'billing_mode', 'expr_b64', 'matched_tier', 'billing_unit',
] as const
const BOOLEAN_KEYS = ['ws', 'is_model_mapped', 'claude'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Parses the JSON string, keeping only known fields of the expected type. */
export function parseLogOther(raw: string | undefined): LogOther {
  if (!raw) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {}
  }
  if (!isRecord(parsed)) return {}
  const other: Record<string, unknown> = {}
  for (const key of NUMBER_KEYS) {
    const value = parsed[key]
    if (typeof value === 'number' && Number.isFinite(value)) other[key] = value
  }
  for (const key of STRING_KEYS) {
    const value = parsed[key]
    if (typeof value === 'string' && value.trim()) other[key] = value.trim()
  }
  for (const key of BOOLEAN_KEYS) {
    if (parsed[key] === true) other[key] = true
  }
  const billing = parsed.billing_tokens
  if (isRecord(billing)) {
    const tokens: Record<string, number> = {}
    for (const key of ['p', 'c', 'cr', 'cc', 'cc1h', 'cc12h']) {
      const value = billing[key]
      if (typeof value === 'number' && Number.isFinite(value)) tokens[key] = value
    }
    other.billing_tokens = tokens
  }
  if (Array.isArray(parsed.content_parts)) {
    other.content_parts = parsed.content_parts.flatMap((part) => logMessage(part, 'key') ?? [])
  }
  const op = logMessage(parsed.op, 'action')
  if (op) other.op = op
  const stream = parsed.stream_status
  if (isRecord(stream)) {
    other.stream_status = {
      ...(typeof stream.status === 'string' ? { status: stream.status } : {}),
      ...(typeof stream.end_reason === 'string' && stream.end_reason ? { end_reason: stream.end_reason } : {}),
      ...(typeof stream.end_error === 'string' && stream.end_error ? { end_error: stream.end_error } : {}),
      ...(typeof stream.error_count === 'number' ? { error_count: stream.error_count } : {}),
      ...(Array.isArray(stream.errors) ? { errors: stream.errors.filter((e): e is string => typeof e === 'string') } : {}),
    }
  }
  return other as LogOther
}

/** OpenAI web search (`/v1/alpha/search`): billed per call, no token usage. */
export function isWebSearch(log: UsageLog): boolean {
  return /\/alpha\/search\/?$/.test(log.other?.request_path ?? '')
}

/** Time to first token in ms, only for streamed calls that recorded it. */
export function firstTokenMs(log: UsageLog): number | null {
  const frt = log.other?.frt
  return log.is_stream && frt != null && frt > 0 ? frt : null
}

/**
 * Output speed in tokens/second over the generation phase: for a stream the
 * wait for the first token is excluded, otherwise the whole call counts.
 */
export function outputTokensPerSecond(log: UsageLog): number | null {
  const tokens = log.completion_tokens
  const total = log.use_time
  if (!tokens || !total || total <= 0) return null
  const ttft = firstTokenMs(log)
  const generation = ttft != null && total - ttft / 1000 > 0 ? total - ttft / 1000 : total
  return tokens / generation
}

export function cacheReadTokens(log: UsageLog): number {
  return log.other?.cache_tokens ?? 0
}

/** Cache writes; the 5m/1h split, when present, replaces the single total. */
export function cacheWriteTokens(log: UsageLog): number {
  const other = log.other
  if (!other) return 0
  if (other.cache_write_tokens != null) return other.cache_write_tokens
  const split = (other.cache_creation_tokens_5m ?? 0) + (other.cache_creation_tokens_1h ?? 0)
  return split > 0 ? split : (other.cache_creation_tokens ?? 0)
}

/**
 * The group ratio the call was billed at. The server logs the applied ratio
 * as `group_ratio` (text_quota.go multiplies by it); `user_group_ratio` is
 * only the user-specific override and is -1 when absent.
 */
export function effectiveGroupRatio(other: LogOther | undefined): number | undefined {
  if (!other) return undefined
  if (other.group_ratio != null) return other.group_ratio
  if (other.user_group_ratio != null && other.user_group_ratio >= 0) return other.user_group_ratio
  return undefined
}

export interface TokenBreakdown {
  /** Input billed at the full input price (cache hits and writes excluded). */
  normalInput: number
  output: number
  cacheRead: number
  cacheWrite: number
  total: number
}

/**
 * Splits a log's tokens the way the server bills them (text_quota.go): with
 * Anthropic semantics prompt_tokens is already the uncached input; with
 * OpenAI semantics it includes cache reads and writes, which are taken out.
 */
export function tokenBreakdown(log: UsageLog): TokenBreakdown | null {
  const billed = log.other?.billing_tokens
  if (billed && (billed.p != null || billed.c != null)) {
    // Tiered billing logs the exact counts it priced; use them as is.
    const normalInput = billed.p ?? 0
    const output = billed.c ?? 0
    const cacheRead = billed.cr ?? 0
    const cacheWrite = (billed.cc ?? 0) + (billed.cc1h ?? 0) + (billed.cc12h ?? 0)
    return { normalInput, output, cacheRead, cacheWrite, total: normalInput + output + cacheRead + cacheWrite }
  }
  if (log.prompt_tokens == null && log.completion_tokens == null) return null
  const prompt = log.prompt_tokens ?? 0
  const output = log.completion_tokens ?? 0
  const cacheRead = cacheReadTokens(log)
  const cacheWrite = cacheWriteTokens(log)
  const anthropic = log.other?.usage_semantic === 'anthropic' || log.other?.claude === true
  const normalInput = anthropic ? prompt : Math.max(prompt - cacheRead - cacheWrite, 0)
  return { normalInput, output, cacheRead, cacheWrite, total: normalInput + output + cacheRead + cacheWrite }
}

/** Model ratio 1 is $0.002 per 1K tokens, i.e. $2 per 1M tokens. */
const USD_PER_M_AT_RATIO_1 = 2

export interface CostBreakdown {
  /** Fixed price per call (USD); token prices are absent then. */
  callPrice?: number
  /** USD per 1M tokens, before the group ratio. */
  inputPrice?: number
  outputPrice?: number
  cacheReadPrice?: number
  cacheWritePrice?: number
  /** USD at the standard (1x) rate, per part. */
  inputFee?: number
  outputFee?: number
  cacheReadFee?: number
  cacheWriteFee?: number
  /** Applied group ratio. */
  ratio?: number
  /** Tiered billing: the condition of the tier that applied, when several exist. */
  tierLabel?: string
}

function decodeBase64Utf8(value: string): string | null {
  try {
    return new TextDecoder().decode(Uint8Array.from(atob(value), (char) => char.charCodeAt(0)))
  } catch {
    return null
  }
}

/** The expression tier a tiered log was charged with. */
function matchedTier(other: LogOther): { tier: PriceTier; label?: string } | null {
  const expression = other.expr_b64 ? decodeBase64Utf8(other.expr_b64) : null
  const tiers = expression ? parseBillingExpr(expression) : null
  if (!tiers?.length) return null
  const index = other.matched_tier ? tiers.findIndex((tier) => tier.name === other.matched_tier) : tiers.length === 1 ? 0 : -1
  if (index < 0) return null
  return { tier: tiers[index]!, label: tiers.length > 1 ? tierConditionText(tiers, index, true) ?? undefined : undefined }
}

function tieredCost(log: UsageLog, other: LogOther, ratio: number | undefined): CostBreakdown | null {
  const match = matchedTier(other)
  const perRequest = other.billing_unit != null && other.billing_unit !== 'token'
  if (match?.tier.fixed != null || perRequest) {
    const callPrice = other.fixed_price ?? match?.tier.fixed
    return { ...(callPrice != null ? { callPrice } : {}), ratio, tierLabel: match?.label }
  }
  if (!match) return ratio == null ? null : { ratio }
  const prices = match.tier.prices
  const billed = other.billing_tokens ?? {}
  const tokens = tokenBreakdown(log)
  const perToken = (count: number, price: number | undefined) => (count * (price ?? 0)) / 1_000_000
  const writePrice = prices.cc
  return {
    inputPrice: prices.p,
    outputPrice: prices.c,
    cacheReadPrice: prices.cr,
    cacheWritePrice: writePrice,
    inputFee: perToken(tokens?.normalInput ?? 0, prices.p),
    outputFee: perToken(tokens?.output ?? 0, prices.c),
    cacheReadFee: perToken(tokens?.cacheRead ?? 0, prices.cr),
    cacheWriteFee:
      perToken(billed.cc ?? 0, writePrice) +
      perToken(billed.cc1h ?? 0, prices.cc1h ?? writePrice) +
      perToken(billed.cc12h ?? 0, prices.cc12h ?? writePrice),
    ratio,
    tierLabel: match.label,
  }
}

/**
 * Per-part prices and fees reconstructed from the logged ratios. These are
 * an explanation of the charge; the authoritative total is the log's quota.
 */
export function costBreakdown(log: UsageLog): CostBreakdown | null {
  const other = log.other
  if (!other) return null
  const ratio = effectiveGroupRatio(other)
  if (other.billing_mode === 'tiered_expr') return tieredCost(log, other, ratio)
  // Per-call pricing never sets a model ratio; a logged positive ratio means
  // token billing even when model_price is present (it can be 0, not -1).
  const tokenBilled = other.model_ratio != null && other.model_ratio > 0
  if (!tokenBilled && other.model_price != null && other.model_price >= 0) return { callPrice: other.model_price, ratio }
  if (other.model_ratio == null) return ratio == null ? null : { ratio }

  const tokens = tokenBreakdown(log)
  const inputPrice = other.model_ratio * USD_PER_M_AT_RATIO_1
  const outputPrice = inputPrice * (other.completion_ratio ?? 1)
  const cacheReadPrice = inputPrice * (other.cache_ratio ?? 1)
  const writeRatio = other.cache_creation_ratio ?? other.cache_creation_ratio_5m ?? 1
  const cacheWritePrice = inputPrice * writeRatio

  // Cache writes: the 5m/1h split and 12h writes carry their own ratios.
  const w5m = other.cache_creation_tokens_5m ?? 0
  const w1h = other.cache_creation_tokens_1h ?? 0
  const w12h = other.cache_creation_tokens_12h ?? 0
  const writeTotal = tokens?.cacheWrite ?? 0
  const rest = Math.max(writeTotal - w5m - w1h - w12h, 0)
  const weightedWrites =
    rest * writeRatio +
    w5m * (other.cache_creation_ratio_5m ?? writeRatio) +
    w1h * (other.cache_creation_ratio_1h ?? writeRatio) +
    w12h * (other.cache_creation_ratio_12h ?? writeRatio)

  const perToken = (count: number, price: number) => (count * price) / 1_000_000
  return {
    inputPrice,
    outputPrice,
    cacheReadPrice,
    cacheWritePrice,
    inputFee: perToken(tokens?.normalInput ?? 0, inputPrice),
    outputFee: perToken(tokens?.output ?? 0, outputPrice),
    cacheReadFee: perToken(tokens?.cacheRead ?? 0, cacheReadPrice),
    cacheWriteFee: perToken(weightedWrites, inputPrice),
    ratio,
  }
}

export type Tone = 'normal' | 'warning' | 'danger'

/** First-token latency: under 5s is normal, under 10s slow, beyond that bad. */
export function firstTokenTone(ms: number): Tone {
  if (ms < 5_000) return 'normal'
  return ms < 10_000 ? 'warning' : 'danger'
}

/** Whole-call duration, judged by throughput when there is enough output. */
export function durationTone(log: UsageLog): Tone {
  const seconds = log.use_time ?? 0
  const tokens = log.completion_tokens ?? 0
  if (tokens >= 100 && seconds > 0) {
    const tps = tokens / seconds
    if (tps >= 15) return 'normal'
    return tps >= 5 ? 'warning' : 'danger'
  }
  if (seconds < 30) return 'normal'
  return seconds < 60 ? 'warning' : 'danger'
}
