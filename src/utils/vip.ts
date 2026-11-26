import type { GrowthEvent, SelfProfile, SiteStatus } from '@/types/api'

/**
 * VIP tiers of the top-up growth programme. The server is authoritative:
 * tiers come from `/api/status` (`vip_tiers`), the account's effective level
 * from `/api/user/self` (`vip_level`) and the growth value from
 * `/api/user/self/growth`. `ratio` is the tier's `TopupGroupRatio`
 * (paid = amount × price × ratio); `minAmount` is in top-up units.
 */
export interface VipTier {
  level: number
  key: string
  name: string
  minAmount: number
  ratio: number
}

/** Used only until `/api/status` arrives, or against an older backend. */
export const DEFAULT_VIP_TIERS: readonly VipTier[] = [
  { level: 0, key: 'VIP0', name: '入门', minAmount: 0, ratio: 1 },
  { level: 1, key: 'VIP1', name: '青铜', minAmount: 500, ratio: 0.99 },
  { level: 2, key: 'VIP2', name: '白银', minAmount: 2_000, ratio: 0.97 },
  { level: 3, key: 'VIP3', name: '黄金', minAmount: 5_000, ratio: 0.95 },
  { level: 4, key: 'VIP4', name: '铂金', minAmount: 20_000, ratio: 0.92 },
  { level: 5, key: 'VIP5', name: '钻石', minAmount: 50_000, ratio: 0.9 },
]

/** Default growth window when the server does not state one. */
export const DEFAULT_GROWTH_WINDOW_DAYS = 365

/** The site's tiers, ordered by level. */
export function vipTiers(config: SiteStatus | undefined): readonly VipTier[] {
  const tiers = config?.vip_tiers
  if (!tiers?.length) return DEFAULT_VIP_TIERS
  return tiers
    .map((tier) => ({ level: tier.level, key: tier.key, name: tier.name, minAmount: tier.min_amount, ratio: tier.topup_ratio }))
    .sort((a, b) => a.level - b.level)
}

export function growthWindowDays(config: SiteStatus | undefined): number {
  return config?.growth_window_days ?? DEFAULT_GROWTH_WINDOW_DAYS
}

/** "VIP2". */
export function tierLabel(tier: VipTier): string {
  return `VIP${tier.level}`
}

/** The tier's top-up rebate as a percentage: "3%". */
export function rebateText(tier: VipTier): string {
  return `${Math.round((1 - tier.ratio) * 1000) / 10}%`
}

const growthFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

/** A growth value as a plain number (1 top-up unit = 1 point), at most 2 decimals. */
export function formatGrowth(amount: number | undefined): string {
  return amount === undefined || !Number.isFinite(amount) ? '—' : growthFormat.format(amount)
}

const SOURCE_TITLES: Record<string, string> = {
  topup: '在线充值',
  redemption: '兑换码',
  admin_adjustment: '管理员调整',
}

export function growthSourceTitle(event: GrowthEvent): string {
  return SOURCE_TITLES[event.source] ?? '成长值变动'
}

/**
 * Splits an account group the way the backend does (`common.SplitUserGroup`):
 * "VIP2" → level 2; "VIP0-大学生优惠" → level 0 + offer; the level part is
 * case-insensitive and the separator one of - － — _ ·. Legacy "default" and
 * a bare offer ("大学生优惠") count as level 0. Anything else (e.g. "svip")
 * is an admin-managed group: no level, the whole name is the offer.
 */
export function splitGroup(group: string | undefined): { level: number | undefined; special: string | undefined } {
  const name = group?.trim()
  if (!name) return { level: undefined, special: undefined }
  if (name.toLowerCase() === 'default') return { level: 0, special: undefined }
  const match = /^vip([0-9])(?:\s*[-－—_·]\s*(.+))?$/i.exec(name)
  if (match) return { level: Number(match[1]), special: match[2]?.trim() || undefined }
  return { level: undefined, special: name }
}

/**
 * The account's effective tier. `vip_level` from `/api/user/self` wins
 * (null = admin-managed custom group, no tier); the login payload lacks it,
 * so the group name is parsed until the profile loads.
 */
export function accountTier(
  user: Pick<SelfProfile, 'group' | 'vip_level'> | undefined,
  tiers: readonly VipTier[]
): VipTier | undefined {
  if (!user) return undefined
  const level = user.vip_level !== undefined ? user.vip_level : splitGroup(user.group).level
  if (level === null || level === undefined) return undefined
  return tiers.find((tier) => tier.level === level)
}

/** The student discount group; its members get a mortarboard on the avatar. */
export const STUDENT_GROUP = '大学生优惠'

/** The account's special offer, e.g. "大学生优惠", or a custom group's name. */
export function accountSpecial(user: Pick<SelfProfile, 'group'> | undefined): string | undefined {
  return splitGroup(user?.group).special
}

export interface VipProgress {
  current: VipTier
  /** Undefined at the top tier. */
  next: VipTier | undefined
  amount: number | undefined
  /** Still to top up before `next`. */
  remaining: number
  /** Progress towards `next`, 0–1 (1 at the top tier). */
  fraction: number
}

/** Progress from the effective tier towards the next one. */
export function vipProgress(current: VipTier, tiers: readonly VipTier[], amount: number | undefined): VipProgress {
  const next = tiers.find((tier) => tier.level === current.level + 1)
  if (!next) return { current, next, amount, remaining: 0, fraction: 1 }
  const value = amount ?? 0
  return {
    current,
    next,
    amount,
    remaining: Math.max(0, next.minAmount - value),
    fraction: next.minAmount > 0 ? Math.min(1, Math.max(0, value / next.minAmount)) : 1,
  }
}

/** The avatar's corner badge: a mortarboard for the student discount. */
export function frameBadge(user: Pick<SelfProfile, 'group'> | undefined): 'student' | undefined {
  return accountSpecial(user) === STUDENT_GROUP ? 'student' : undefined
}
