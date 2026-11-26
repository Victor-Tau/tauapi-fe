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
  /** Compact (compressed) request. */
  compact?: boolean
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
  /** Request-conditional multipliers of the expression and whether each applied. */
  request_rules?: { cond: string; multiplier: number; matched: boolean }[]
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
  /** Wallet quota credited by a referral rebate (request_id referral-rebate-<id>). */
  referral_rebate_quota?: number
  /** Wallet quota credited by a fixed invitation reward (request_id invitation-reward-<id>). */
  invitation_reward_quota?: number
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
  'referral_rebate_quota', 'invitation_reward_quota',
] as const
const STRING_KEYS = [
  'reasoning_effort', 'request_path', 'upstream_model_name', 'billing_source', 'subscription_plan_title',
  'usage_semantic', 'billing_mode', 'expr_b64', 'matched_tier', 'billing_unit',
] as const
const BOOLEAN_KEYS = ['ws', 'is_model_mapped', 'claude', 'compact'] as const

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
  if (Array.isArray(parsed.request_rules)) {
    other.request_rules = parsed.request_rules.flatMap((rule) =>
      isRecord(rule) && typeof rule.cond === 'string' && typeof rule.multiplier === 'number' && Number.isFinite(rule.multiplier)
        ? [{ cond: rule.cond, multiplier: rule.multiplier, matched: rule.matched === true }]
        : []
    )
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

/**
 * Fast mode: a matched request rule of the billing expression tests
 * `param("service_tier")` for "fast" or "priority", e.g.
 * `param("service_tier") == "priority"`.
 */
export function isPriorityTier(log: UsageLog): boolean {
  return (log.other?.request_rules ?? []).some((rule) => rule.matched && isFastRule(rule))
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
  /** Short form of the tier condition for the ratio formula, e.g. ">500K". */
  tierShort?: string
  /** This request's charge on the matched tier relative to the first tier (≠ 1 only). */
  tierFactor?: number
  /** Matched request-rule multipliers, e.g. { label: "fast", multiplier: 2 }. */
  ruleFactors?: { label: string; multiplier: number }[]
}

type RequestRuleLog = NonNullable<LogOther['request_rules']>[number]

/** A rule that tests `param("service_tier")` for "fast" or "priority". */
function isFastRule(rule: RequestRuleLog): boolean {
  return (
    !rule.cond.includes('!=') &&
    /service_tier/.test(rule.cond) &&
    /["'](fast|priority)["']/i.test(rule.cond)
  )
}

function matchedRuleFactors(other: LogOther): { label: string; multiplier: number }[] {
  return (other.request_rules ?? [])
    .filter((rule) => rule.matched && rule.multiplier !== 1)
    .map((rule) => ({ label: isFastRule(rule) ? 'fast' : rule.cond, multiplier: rule.multiplier }))
}

function decodeBase64Utf8(value: string): string | null {
  try {
    return new TextDecoder().decode(Uint8Array.from(atob(value), (char) => char.charCodeAt(0)))
  } catch {
    return null
  }
}

/** The expression tier a tiered log was charged with. */
function matchedTier(
  other: LogOther
): { tier: PriceTier; label?: string; short?: string; base: PriceTier; first: boolean } | null {
  const expression = other.expr_b64 ? decodeBase64Utf8(other.expr_b64) : null
  const tiers = expression ? parseBillingExpr(expression) : null
  if (!tiers?.length) return null
  const index = other.matched_tier ? tiers.findIndex((tier) => tier.name === other.matched_tier) : tiers.length === 1 ? 0 : -1
  if (index < 0) return null
  const label = tiers.length > 1 ? tierConditionText(tiers, index, true) ?? undefined : undefined
  // "上下文 > 500K" → ">500K"
  const short = label?.replace(/^\S+\s+/, '').replace(/\s+/g, '').replace(/\.0+(?=\D*$)/, '')
  return { tier: tiers[index]!, label, short, base: tiers[0]!, first: index === 0 }
}

/** Cost of this request's tokens at a tier's base prices (USD), or null if not token-priced. */
function tierTokenCost(log: UsageLog, other: LogOther, tier: PriceTier): number | null {
  if (tier.fixed != null) return tier.fixed
  const tokens = tokenBreakdown(log)
  if (!tokens) return null
  const billed = other.billing_tokens ?? {}
  const prices = tier.prices
  const cc = prices.cc ?? 0
  return (
    tokens.normalInput * (prices.p ?? 0) +
    tokens.output * (prices.c ?? 0) +
    tokens.cacheRead * (prices.cr ?? 0) +
    (billed.cc ?? (billed.cc1h || billed.cc12h ? 0 : tokens.cacheWrite)) * cc +
    (billed.cc1h ?? 0) * (prices.cc1h ?? cc) +
    (billed.cc12h ?? 0) * (prices.cc12h ?? cc)
  )
}

function tierExtras(log: UsageLog, other: LogOther, match: NonNullable<ReturnType<typeof matchedTier>>) {
  const extras: Pick<CostBreakdown, 'tierLabel' | 'tierShort' | 'tierFactor'> = {
    tierLabel: match.label,
    tierShort: match.short,
  }
  if (!match.first) {
    // The tier multiplier is quoted on the input price (e.g. >500K doubles it);
    // fall back to this request's cost ratio when input is not priced.
    const ownInput = match.tier.prices.p
    const baseInput = match.base.prices.p
    const byInput = ownInput != null && baseInput != null && baseInput > 0
    const own = byInput ? ownInput : tierTokenCost(log, other, match.tier)
    const base = byInput ? baseInput : tierTokenCost(log, other, match.base)
    if (own != null && base != null && base > 0 && Math.abs(own / base - 1) > 1e-9) extras.tierFactor = own / base
  }
  return extras
}

function tieredCost(log: UsageLog, other: LogOther, ratio: number | undefined): CostBreakdown | null {
  const match = matchedTier(other)
  const perRequest = other.billing_unit != null && other.billing_unit !== 'token'
  if (match?.tier.fixed != null || perRequest) {
    const factor = (other.request_rules ?? []).reduce((acc, rule) => (rule.matched ? acc * rule.multiplier : acc), 1)
    const callPrice = other.fixed_price ?? (match?.tier.fixed != null ? match.tier.fixed * factor : undefined)
    return {
      ...(callPrice != null ? { callPrice } : {}),
      ratio,
      ...(match ? tierExtras(log, other, match) : {}),
      ruleFactors: matchedRuleFactors(other),
    }
  }
  if (!match) return { ratio, ruleFactors: matchedRuleFactors(other) }
  // Matched request rules (e.g. service_tier = priority → ×2) scale every price.
  const factor = (other.request_rules ?? []).reduce((acc, rule) => (rule.matched ? acc * rule.multiplier : acc), 1)
  const prices = Object.fromEntries(
    Object.entries(match.tier.prices).map(([key, value]) => [key, value * factor])
  ) as PriceTier['prices']
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
    ...tierExtras(log, other, match),
    ruleFactors: matchedRuleFactors(other),
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

/** First-token latency: under 10s is normal, under 15s slow, beyond that bad. */
export function firstTokenTone(ms: number): Tone {
  if (ms < 10_000) return 'normal'
  return ms < 15_000 ? 'warning' : 'danger'
}
