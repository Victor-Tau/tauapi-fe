import { z } from "zod"
import { apiClient } from "./request"
import { parseData } from "./schema"
import { queryString } from "./shared"

const integer = z.number().finite().int()
const nonnegative = integer.nonnegative()

export interface ReferralPermissions {
  invitation_enabled: boolean
  rebate_enabled: boolean
  /** Effective rate in basis points (750 = 7.5%); present when rebates are on. */
  rate_bps?: number
}

export interface ReferralInvitee {
  id: number
  username: string
  /** Masked by the server; "" when there is none. */
  email: string
}

export type ReferralRecordType = "invitation_reward" | "topup_rebate"

/**
 * One referral earning: a fixed invitation reward or a top-up rebate. IDs are
 * unique only within a record type.
 */
export interface ReferralRebate {
  id: number
  record_type: ReferralRecordType
  /** Invited user's username; may be "". */
  username: string
  /** Decimal string in the paid currency, e.g. "7.35". */
  paid_amount: string
  paid_currency: string
  rate_bps: number
  rebate_quota: number
  /** Redemption-code top-ups only: the code's face value (wallet quota). */
  redemption_quota?: number
  /** Top-up time, Unix seconds. */
  created_at: number
  /** Credit time, Unix seconds; 0 = not credited yet. */
  credited_at: number
  /** Earliest credit time, Unix seconds. */
  available_at?: number
  exchange_rate_pending?: boolean
  /** Seconds until the earliest possible credit; 0 once due (still pending until credited_at > 0). */
  remaining_seconds?: number
}

export interface ReferralPage<T> {
  page: number
  page_size: number
  total: number
  items: T[]
}

const permissionsSchema: z.ZodType<ReferralPermissions> = z.object({
  invitation_enabled: z.boolean(),
  rebate_enabled: z.boolean(),
  rate_bps: nonnegative.optional(),
})

function pageSchema<T>(item: z.ZodType<T>): z.ZodType<ReferralPage<T>> {
  return z.object({
    page: integer.positive(),
    page_size: integer.positive(),
    total: nonnegative,
    items: z
      .array(item)
      .nullable()
      .transform((items) => items ?? []),
  })
}

const inviteeSchema: z.ZodType<ReferralInvitee> = z.object({
  id: integer,
  username: z.string(),
  email: z
    .string()
    .nullable()
    .optional()
    .transform((email) => email ?? ""),
})

const rebateSchema: z.ZodType<ReferralRebate> = z.object({
  id: integer,
  // Servers before v0.1.10 only returned top-up rebates.
  record_type: z
    .enum(["invitation_reward", "topup_rebate"])
    .optional()
    .catch(undefined)
    .transform((type) => type ?? "topup_rebate"),
  username: z
    .string()
    .nullable()
    .optional()
    .transform((name) => name ?? ""),
  paid_amount: z.union([z.string(), z.number()]).transform(String),
  paid_currency: z.string(),
  rate_bps: nonnegative,
  rebate_quota: z.number().finite(),
  redemption_quota: z.number().finite().optional(),
  created_at: integer,
  credited_at: integer,
  available_at: integer.optional(),
  exchange_rate_pending: z.boolean().optional(),
  remaining_seconds: z
    .number()
    .finite()
    .optional()
    .transform((value) =>
      value === undefined ? undefined : Math.max(0, value)
    ),
})

/** Not credited yet and not blocked on an exchange rate. */
export function isAwaitingCredit(row: ReferralRebate): boolean {
  return (
    row.credited_at <= 0 &&
    row.exchange_rate_pending !== true &&
    row.rebate_quota > 0
  )
}

export async function getReferralPermissions(signal?: AbortSignal) {
  return parseData(
    permissionsSchema,
    await apiClient.request("/api/user/referral/permissions", { signal }),
    "邀请权限"
  )
}

/** Returns the user's affiliate code, generating one if the account has none. */
export async function getAffCode(signal?: AbortSignal) {
  return parseData(
    z.string().min(1),
    await apiClient.request("/api/user/aff", { signal }),
    "邀请码"
  )
}

export async function listInvitees(
  page: number,
  pageSize: number,
  signal?: AbortSignal
) {
  return parseData(
    pageSchema(inviteeSchema),
    await apiClient.request(
      `/api/user/referral/invitees${queryString({ p: page, page_size: pageSize })}`,
      { signal }
    ),
    "邀请名单"
  )
}

export async function listRebates(
  page: number,
  pageSize: number,
  signal?: AbortSignal
) {
  return parseData(
    pageSchema(rebateSchema),
    await apiClient.request(
      `/api/user/referral/rebates${queryString({ p: page, page_size: pageSize })}`,
      { signal }
    ),
    "邀请收益"
  )
}

/** Scanned in full so the record card can filter by type locally (no server filter). */
const REBATE_PAGE_SIZE = 100
const REBATE_MAX_PAGES = 20

export async function listAllRebates(signal?: AbortSignal) {
  const items: ReferralRebate[] = []
  for (let p = 1; p <= REBATE_MAX_PAGES; p++) {
    const page = await listRebates(p, REBATE_PAGE_SIZE, signal)
    items.push(...page.items)
    if (page.items.length < REBATE_PAGE_SIZE || items.length >= page.total)
      return { items, total: page.total, complete: true }
  }
  return { items, total: items.length, complete: false }
}
