import type { SiteStatus, UsageLog } from '@/types/api'
import type { LogMessage } from './log-other'

/** Log types that can move the balance (`model/log.go`). */
export const BALANCE_TYPES = [
  { value: 0, label: '全部' },
  { value: 1, label: '充值' },
  { value: 2, label: '消费' },
  { value: 6, label: '退款' },
  { value: 4, label: '赠送' },
] as const

const TYPE_LABELS: Record<number, string> = { 1: '充值', 2: '消费', 3: '管理', 4: '赠送', 5: '失败', 6: '退款' }

export function balanceTypeLabel(type: number): string {
  return TYPE_LABELS[type] ?? '其他'
}

export interface BalanceEntry {
  title: string
  detail?: string
  /** Signed raw quota; null when the record does not state an amount. */
  change: number | null
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : typeof value === 'number' ? String(value) : undefined
}

function rawNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim())) return Number(value)
  return null
}

/**
 * Top-up and bonus logs carry the amount only as text the server formatted
 * with its display setting (`logger.FormatQuota`): "＄0.500000", "¥3.600000",
 * a custom symbol, or a bare integer for quota display. Converts it back to
 * raw quota; null when it cannot be done safely.
 */
export function parseFormattedQuota(text: unknown, config?: SiteStatus): number | null {
  if (typeof text === 'number') return Number.isFinite(text) ? text : null
  if (typeof text !== 'string') return null
  const match = /^(\D*?)\s*(-?\d+(?:\.\d+)?)$/.exec(text.trim())
  if (!match) return null
  const symbol = match[1].trim()
  const amount = Number(match[2])
  if (!symbol) return amount
  const perUnit = config?.quota_per_unit
  if (!perUnit || perUnit <= 0) return null
  if (symbol === '＄' || symbol === '$') return Math.round(amount * perUnit)
  if (symbol === '¥' || symbol === '￥') {
    const rate = config?.usd_exchange_rate
    return rate && rate > 0 ? Math.round((amount / rate) * perUnit) : null
  }
  const rate = config?.custom_currency_exchange_rate
  if (symbol === config?.custom_currency_symbol && rate && rate > 0) return Math.round((amount / rate) * perUnit)
  return null
}

/** "支付 10.00": payment amounts arrive as "%f" text ("10.000000") or a number. */
function paid(value: unknown): string | undefined {
  const amount = rawNumber(value)
  if (amount !== null) return `支付 ${amount.toFixed(2)}`
  const text = str(value)
  return text && `支付 ${text}`
}

function fromMessage(part: LogMessage, config?: SiteStatus): BalanceEntry | null {
  const p = part.params
  const quota = parseFormattedQuota(p.quota, config)
  switch (part.key) {
    case 'Online top-up succeeded, amount added: {{quota}}, payment amount: {{amount}}':
      return { title: '在线充值', detail: paid(p.amount), change: quota }
    case 'Administrator completed the order, amount added: {{quota}}, payment amount: {{amount}}':
      return { title: '管理员补单', detail: paid(p.amount), change: quota }
    case 'Topped up {{quota}} with a redemption code, code ID {{id}}':
      return { title: '兑换码充值', detail: str(p.id) && `兑换码 #${str(p.id)}`, change: quota }
    case '{{provider}} top-up succeeded, amount added: {{quota}}, payment amount: {{amount}}':
      return { title: `${str(p.provider) ?? ''}在线充值`.trim(), detail: paid(p.amount), change: quota }
    case 'Subscription purchased with balance, plan: {{plan}}, payment amount: {{amount}}, quota deducted: {{quota}}':
      return { title: '余额购买订阅', detail: str(p.plan), change: quota === null ? null : -quota }
    case 'Subscription purchased, plan: {{plan}}, payment amount: {{amount}}, payment method: {{method}}':
      // Paid outside the wallet: the balance does not move.
      return { title: '购买订阅', detail: [str(p.plan), str(p.method)].filter(Boolean).join(' · ') || undefined, change: 0 }
    case 'New user sign-up bonus {{quota}}':
      return { title: '新用户注册奖励', change: quota }
    case 'Invitation code bonus {{quota}}':
      return { title: '邀请码奖励', change: quota }
    case 'Bonus for inviting a user {{quota}}':
      return { title: '邀请用户奖励', change: quota }
    case 'Daily check-in, received {{quota}}':
      return { title: '每日签到', change: quota }
  }
  return null
}

function fromOperation(op: LogMessage): BalanceEntry | null {
  const value = rawNumber(op.params.quota)
  switch (op.key) {
    case 'user.quota_add':
      return { title: '管理员增加额度', change: value }
    case 'user.quota_subtract':
      return { title: '管理员扣减额度', change: value === null ? null : -value }
    case 'user.quota_override': {
      const from = rawNumber(op.params.from)
      const to = rawNumber(op.params.to)
      return { title: '管理员调整额度', change: from === null || to === null ? null : to - from }
    }
  }
  return null
}

/** What a log did to the balance, described for the bill. */
export function balanceEntry(log: UsageLog, config?: SiteStatus): BalanceEntry {
  const model = log.model_name?.trim()
  const token = log.token_name?.trim()
  switch (log.type) {
    case 2:
      return { title: model || '模型调用', detail: token && `密钥 ${token}`, change: -(log.quota ?? 0) }
    case 6:
      return { title: model ? `退款 · ${model}` : '任务退款', detail: token && `密钥 ${token}`, change: log.quota ?? 0 }
    case 5:
      return { title: model || '调用失败', detail: '未扣费', change: 0 }
  }
  const op = log.other?.op && fromOperation(log.other.op)
  if (op) return op
  for (const part of log.other?.content_parts ?? []) {
    const entry = fromMessage(part, config)
    if (entry) return entry
  }
  return {
    title: log.content?.trim() || balanceTypeLabel(log.type),
    change: log.quota ? log.quota : null,
  }
}
