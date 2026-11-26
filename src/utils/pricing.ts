import type { PricingCatalog, PricingModel, SiteStatus } from '@/types/api'
import { formatDecimal, formatTokens, quotaDisplay } from './format'

/**
 * Price variables of New API billing expressions. Coefficients are real USD
 * prices per 1M tokens; `fixed(x)` is USD per request (upstream
 * pkg/billingexpr/expr.md). `len` is only used in tier conditions.
 */
export const PRICE_VARS = [
  ['p', '输入'],
  ['c', '输出'],
  ['cr', '缓存读取'],
  ['cc', '缓存写入'],
  ['cc1h', '缓存写入（1 小时）'],
  ['cc12h', '缓存写入（12 小时）'],
  ['img', '图片输入'],
  ['img_cr', '图片缓存读取'],
  ['img_o', '图片输出'],
  ['ai', '音频输入'],
  ['ao', '音频输出'],
] as const

export type PriceVar = (typeof PRICE_VARS)[number][0]

const PRICE_VAR_SET = new Set<string>(PRICE_VARS.map(([key]) => key))
const CONDITION_LABELS: Record<string, string> = { len: '输入上下文', p: '输入', c: '输出' }

export interface TierCondition {
  variable: string
  op: '<' | '<=' | '>' | '>='
  value: number
}

export interface PriceTier {
  /** Tier name from the expression, e.g. "0_500k". */
  name?: string
  /** Applies when this holds; the final tier of a chain has none. */
  condition?: TierCondition
  /** USD per 1M tokens, by variable. */
  prices: Partial<Record<PriceVar, number>>
  /** USD per request. */
  fixed?: number
}

/** A request-conditional factor: `(param("x") == "y" ? 2 : 1)`. */
export interface RequestRule {
  source: 'param' | 'header'
  key: string
  op: '==' | '!=' | 'has'
  value: string | number
  multiplier: number
}

export type ModelPricing =
  | { kind: 'tokens'; tiers: PriceTier[]; rules: RequestRule[] }
  | { kind: 'request'; tiers: PriceTier[]; rules: RequestRule[] }
  /** An expression shape this page does not break down; show it verbatim. */
  | { kind: 'custom'; expression: string }

type Token =
  | { type: 'num'; value: number }
  | { type: 'id'; value: string }
  | { type: 'str'; value: string }
  | { type: 'op'; value: string }

const TOKEN = /\s*(?:(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\.\d+)|([A-Za-z_][A-Za-z0-9_]*)|"((?:[^"\\]|\\.)*)"|(<=|>=|==|!=|[<>?:(),*+]))/y

function tokenize(source: string): Token[] | null {
  const tokens: Token[] = []
  TOKEN.lastIndex = 0
  while (TOKEN.lastIndex < source.length) {
    if (!source.slice(TOKEN.lastIndex).trim()) break
    const start = TOKEN.lastIndex
    const match = TOKEN.exec(source)
    if (!match || TOKEN.lastIndex === start) return null
    if (match[1] !== undefined) tokens.push({ type: 'num', value: Number(match[1]) })
    else if (match[2] !== undefined) tokens.push({ type: 'id', value: match[2] })
    else if (match[3] !== undefined) tokens.push({ type: 'str', value: match[3].replace(/\\(.)/g, '$1') })
    else tokens.push({ type: 'op', value: match[4]! })
  }
  return tokens
}

/** Base tiers of a billing expression (request multipliers not applied). */
export function parseBillingExpr(expression: string): PriceTier[] | null {
  return parseBillingExprFull(expression)?.tiers ?? null
}

/**
 * Parses the display-friendly subset of billing expressions:
 *   [cond ? ] tier("name", p * 2 + c * 10 + …) [: …]   or   tier("name", fixed(x))
 * optionally parenthesised and multiplied by constants or request rules
 *   (…) * (param("service_tier") == "priority" ? 2 : 1)
 * Returns null for anything else so callers fall back to the raw expression.
 */
export function parseBillingExprFull(expression: string): { tiers: PriceTier[]; rules: RequestRule[] } | null {
  const tokens = tokenize(expression.trim().replace(/^v\d+:/, ''))
  if (!tokens?.length) return null
  let index = 0
  const peek = (offset = 0) => tokens[index + offset]
  const take = () => tokens[index++]
  const expectOp = (value: string) => {
    const token = take()
    if (token?.type !== 'op' || token.value !== value) throw new Error('syntax')
  }
  const expectNumber = () => {
    const token = take()
    if (token?.type !== 'num' || !Number.isFinite(token.value)) throw new Error('syntax')
    return token.value
  }

  function parseBody(tier: PriceTier) {
    const first = peek()
    if (first?.type === 'id' && first.value === 'fixed') {
      take()
      expectOp('(')
      tier.fixed = expectNumber()
      expectOp(')')
      return
    }
    for (;;) {
      const a = take()
      expectOp('*')
      const b = take()
      const [variable, coefficient] =
        a?.type === 'id' && b?.type === 'num' ? [a.value, b.value]
          : a?.type === 'num' && b?.type === 'id' ? [b.value, a.value]
            : [null, null]
      if (variable === null || coefficient === null || !PRICE_VAR_SET.has(variable)) throw new Error('syntax')
      const key = variable as PriceVar
      tier.prices[key] = (tier.prices[key] ?? 0) + coefficient
      const next = peek()
      if (next?.type === 'op' && next.value === '+') { take(); continue }
      return
    }
  }

  function parseTier(): PriceTier {
    const head = take()
    if (head?.type !== 'id' || head.value !== 'tier') throw new Error('syntax')
    expectOp('(')
    const name = take()
    if (name?.type !== 'str') throw new Error('syntax')
    expectOp(',')
    const tier: PriceTier = { name: name.value, prices: {} }
    parseBody(tier)
    expectOp(')')
    return tier
  }

  function parseChain(): PriceTier[] {
    const first = peek()
    const op = peek(1)
    if (first?.type === 'id' && first.value in CONDITION_LABELS && op?.type === 'op' && ['<', '<=', '>', '>='].includes(op.value)) {
      take(); take()
      const condition: TierCondition = { variable: first.value, op: op.value as TierCondition['op'], value: expectNumber() }
      expectOp('?')
      const tier = { ...parseTier(), condition }
      expectOp(':')
      return [tier, ...parseChain()]
    }
    return [parseTier()]
  }

  function parseRule(): RequestRule {
    const fn = take()
    if (fn?.type !== 'id' || (fn.value !== 'param' && fn.value !== 'header')) throw new Error('syntax')
    expectOp('(')
    const key = take()
    if (key?.type !== 'str') throw new Error('syntax')
    expectOp(')')
    const op = take()
    const opValue =
      op?.type === 'op' && (op.value === '==' || op.value === '!=') ? op.value
        : op?.type === 'id' && op.value === 'has' ? 'has'
          : null
    if (!opValue) throw new Error('syntax')
    const value = take()
    if (value?.type !== 'str' && value?.type !== 'num') throw new Error('syntax')
    expectOp('?')
    const multiplier = expectNumber()
    expectOp(':')
    if (expectNumber() !== 1) throw new Error('syntax')
    return { source: fn.value, key: key.value, op: opValue, value: value.value, multiplier }
  }

  /** Scales every price in the tiers by a constant factor. */
  function scale(tiers: PriceTier[], factor: number) {
    for (const tier of tiers) {
      if (tier.fixed !== undefined) tier.fixed *= factor
      for (const key of Object.keys(tier.prices) as PriceVar[]) tier.prices[key]! *= factor
    }
  }

  function parseProduct(): { tiers: PriceTier[]; rules: RequestRule[] } {
    let tiers: PriceTier[] | null = null
    const rules: RequestRule[] = []
    let factor = 1
    for (;;) {
      const token = peek()
      if (token?.type === 'num') {
        take()
        factor *= token.value
      } else if (token?.type === 'op' && token.value === '(') {
        take()
        const inner = peek()
        if (inner?.type === 'id' && (inner.value === 'param' || inner.value === 'header')) {
          rules.push(parseRule())
        } else {
          if (tiers) throw new Error('syntax')
          const nested = parseProduct()
          tiers = nested.tiers
          rules.push(...nested.rules)
        }
        expectOp(')')
      } else {
        if (tiers) throw new Error('syntax')
        tiers = parseChain()
      }
      const next = peek()
      if (next?.type === 'op' && next.value === '*') { take(); continue }
      break
    }
    if (!tiers) throw new Error('syntax')
    if (factor !== 1) scale(tiers, factor)
    return { tiers, rules }
  }

  try {
    const result = parseProduct()
    return index === tokens.length ? result : null
  } catch {
    return null
  }
}

/** Resolve a model's prices (USD) from its billing expression or legacy ratios. */
export function modelPricing(model: PricingModel, config?: SiteStatus): ModelPricing {
  if (model.billing_mode === 'tiered_expr') {
    const expression = model.billing_expr ?? ''
    const parsed = parseBillingExprFull(expression)
    if (!parsed) return { kind: 'custom', expression }
    const { tiers, rules } = parsed
    return { kind: tiers.every((tier) => tier.fixed !== undefined) ? 'request' : 'tokens', tiers, rules }
  }
  if (model.quota_type === 1) return { kind: 'request', tiers: [{ prices: {}, fixed: model.model_price }], rules: [] }
  // Legacy ratio pricing: ModelRatio * 1e6 / QuotaPerUnit is USD per 1M input tokens.
  const quotaPerUnit = config?.quota_per_unit && config.quota_per_unit > 0 ? config.quota_per_unit : 500_000
  const input = (model.model_ratio * 1_000_000) / quotaPerUnit
  const prices: PriceTier['prices'] = { p: input, c: input * model.completion_ratio }
  if (typeof model.cache_ratio === 'number') prices.cr = input * model.cache_ratio
  if (typeof model.create_cache_ratio === 'number') prices.cc = input * model.create_cache_ratio
  return { kind: 'tokens', tiers: [{ prices }], rules: [] }
}

/** Human label for a request rule's condition, e.g. "Fast". */
export function requestRuleText(rule: RequestRule): string {
  const value = String(rule.value)
  if (rule.source === 'param' && rule.key === 'service_tier' && rule.op === '==' && value === 'priority') {
    return 'Fast'
  }
  const subject = rule.source === 'param' ? `请求参数 ${rule.key}` : `请求头 ${rule.key}`
  const verb = rule.op === 'has' ? '包含' : rule.op === '!=' ? '≠' : '='
  return `${subject} ${verb} ${value}`
}

/** Lowest ratio among the model's groups, or the chosen group's ratio (upstream behaviour). */
export function displayGroupRatio(model: PricingModel, groupRatio: Record<string, number>, group?: string): number {
  if (group && model.enable_groups.includes(group)) return groupRatio[group] ?? 1
  const ratios = model.enable_groups.map((name) => groupRatio[name]).filter((ratio): ratio is number => typeof ratio === 'number' && Number.isFinite(ratio))
  return ratios.length ? Math.min(...ratios) : 1
}

export interface GroupRatioParts {
  /** The group's own ratio. */
  base: number
  /** Extra factor for the user's group (e.g. 0.9); null when none applies. */
  discount: number | null
  /** What the user pays: base × discount. */
  effective: number
}

/** Splits a group's ratio for this user into the group's own ratio × the user-group factor. */
export function groupRatioParts(catalog: PricingCatalog, group: string): GroupRatioParts {
  const effective = catalog.group_ratio[group] ?? 1
  const base = catalog.base_group_ratio[group]
  // Unknown or free base: nothing to divide by, so show the user's ratio as is.
  if (base === undefined || !(base > 0)) return { base: effective, discount: null, effective }
  const discount = Number((effective / base).toFixed(6))
  return { base, discount: discount === 1 ? null : discount, effective }
}

/** USD → the site's display currency, using the same conversion as quota amounts. */
export function formatUsd(usd: number, config?: SiteStatus): string {
  const { value, unit } = quotaDisplay(usd * (config?.quota_per_unit ?? 0), config)
  // Without a usable currency setting quotaDisplay falls back to "quota"; prices are USD natively.
  if (unit === 'quota' || value === '—') {
    return `$${formatDecimal(usd)}`
  }
  if (unit === 'USD') return `$${value}`
  if (unit === 'CNY') return `¥${value}`
  return `${unit} ${value}`
}

const OP_TEXT: Record<TierCondition['op'], string> = { '<': '<', '<=': '≤', '>': '>', '>=': '≥' }
const NEGATED: Record<TierCondition['op'], TierCondition['op']> = { '<': '>=', '<=': '>', '>': '<=', '>=': '<' }

const COMPACT_CONDITION_LABELS: Record<string, string> = { len: '上下文', p: '输入', c: '输出' }

/** Human condition for tier `index`; the final tier negates the previous one. */
export function tierConditionText(tiers: PriceTier[], index: number, compact = false): string | null {
  const own = tiers[index]?.condition
  const condition = own ?? (index > 0 && tiers[index - 1]?.condition
    ? { ...tiers[index - 1]!.condition!, op: NEGATED[tiers[index - 1]!.condition!.op] }
    : undefined)
  if (!condition) return null
  const label = (compact ? COMPACT_CONDITION_LABELS : CONDITION_LABELS)[condition.variable] ?? condition.variable
  return `${label} ${OP_TEXT[condition.op]} ${formatTokens(condition.value)}${compact ? '' : ' tokens'}`
}
