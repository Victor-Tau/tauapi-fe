import { z } from 'zod'
import { ApiError } from './errors'
import { parseLogOther } from '@/utils/log-other'
import type { CreateKeyRequest, LoginSession, ModelApiToken, PebbleConfig, SelfGrowth, SelfProfile, SiteStatus, StatusVipTier, UsageLog, UsageStat, UserGroups } from '@/types/api'

const number = z.number().finite()
const integer = number.int()
const nonnegative = integer.nonnegative()

export const pebbleSchema: z.ZodType<PebbleConfig> = z.object({
  trait: nonnegative,
  eyes: nonnegative,
  palette: nonnegative,
  blush: z.boolean(),
})

export const selfSchema: z.ZodType<SelfProfile> = z.object({
  id: integer.positive(),
  username: z.string().min(1),
  display_name: z.string().optional(),
  email: z.string().optional(),
  role: integer.optional(),
  status: integer.optional(),
  group: z.string().optional(),
  quota: number.optional(),
  used_quota: number.optional(),
  request_count: nonnegative.optional(),
  has_password: z.boolean().optional(),
  github_id: z.string().optional(),
  google_id: z.string().optional(),
  linux_do_id: z.string().optional(),
  created_at: integer.optional(),
  vip_level: integer.nullable().optional(),
  // A malformed avatar falls back to the default rather than breaking the profile.
  pebble: pebbleSchema.nullable().optional().catch(null),
  aff_code: z.string().optional().catch(undefined),
  aff_count: nonnegative.optional().catch(undefined),
  aff_history_quota: number.optional().catch(undefined),
})

const announcementSchema = z.object({
  id: z.union([number, z.string()]).optional(),
  content: z.string(),
  publishDate: z.string().optional(),
  type: z.string().optional(),
  extra: z.string().optional(),
})

export const statusSchema: z.ZodType<SiteStatus> = z.object({
  version: z.string().optional(),
  system_name: z.string().optional(),
  quota_per_unit: number.positive().optional(),
  quota_display_type: z.string().optional(),
  display_in_currency: z.boolean().optional(),
  usd_exchange_rate: number.optional(),
  custom_currency_exchange_rate: number.optional(),
  custom_currency_symbol: z.string().optional(),
  password_login_enabled: z.boolean().optional(),
  password_login_encryption_enabled: z.boolean().optional(),
  turnstile_check: z.boolean().optional(),
  register_enabled: z.boolean().optional(),
  password_register_enabled: z.boolean().optional(),
  email_verification: z.boolean().optional(),
  log_max_range_days: number.optional(),
  enable_data_export: z.boolean().optional(),
  data_export_default_time: z.string().optional(),
  announcements_enabled: z.boolean().optional(),
  // Admin-authored content: one malformed entry is dropped, and a malformed
  // list never breaks the status the whole app depends on.
  announcements: z
    .array(z.unknown())
    .nullable()
    .optional()
    .transform((items) => (items ?? []).flatMap((item) => {
      const parsed = announcementSchema.safeParse(item)
      return parsed.success && parsed.data.content.trim() ? [parsed.data] : []
    }))
    .catch([]),
  // Malformed tiers fall back to the built-in table (utils/vip.ts).
  vip_tiers: z
    .array(z.object({
      level: nonnegative,
      key: z.string().min(1),
      name: z.string(),
      min_amount: number.nonnegative(),
      topup_ratio: number.positive(),
    }) satisfies z.ZodType<StatusVipTier>)
    .optional()
    .catch(undefined),
  growth_window_days: integer.positive().optional().catch(undefined),
})

export const selfGrowthSchema: z.ZodType<SelfGrowth> = z.object({
  window_days: integer.positive(),
  amount: number,
  level: integer.nullable(),
  next: z.object({ level: nonnegative, min_amount: number }).nullable(),
  records: z.object({
    items: z
      .array(z.object({
        id: integer,
        quota: number,
        amount: number,
        source: z.string(),
        created_at: integer,
      }))
      .nullable()
      .transform((items) => items ?? []),
    total: nonnegative,
  }),
})

export const encryptionSchema = z.object({
  enabled: z.boolean(),
  kid: z.string().optional(),
  public_key: z.string().optional(),
})

export const authBundleSchema = z.object({
  access_token: z.string().min(1).refine((token) => !token.startsWith('sk-')),
  token_type: z.string().refine((type) => type.toLowerCase() === 'bearer'),
  access_expires_at: integer.positive(),
  user: selfSchema,
  session: z.object({ sid: z.string().min(1) }),
})

export type AuthBundle = z.infer<typeof authBundleSchema>

/** Access credentials re-issued for the current session after a security change. */
export const rotationSchema = authBundleSchema.omit({ user: true })

/**
 * "sk-abcd••••wxyz" from the server's masked key ("abcd**********wxyz") or,
 * defensively, from a full key. Anything shorter yields no preview.
 */
function keyPreview(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const key = raw.trim().replace(/^(?:sk-)+/, '')
  const masked = /^([^*]{4})\*+([^*]{4})$/.exec(key)
  if (masked) return `sk-${masked[1]}••••${masked[2]}`
  if (key.length > 8 && !/[\s*•]/.test(key)) return `sk-${key.slice(0, 4)}••••${key.slice(-4)}`
  return undefined
}

export const tokenSchema: z.ZodType<ModelApiToken> = z.object({
  id: integer.positive(),
  name: z.string(),
  // Keep only the first and last 4 characters, even if an older deployment
  // returns the complete key, before Query caches it.
  key: z.unknown().optional().transform(keyPreview),
  status: integer,
  created_time: integer.optional(),
  accessed_time: integer.optional(),
  expired_time: integer.optional(),
  remain_quota: number.optional(),
  used_quota: number.optional(),
  unlimited_quota: z.boolean().optional(),
  model_limits_enabled: z.boolean().optional(),
  model_limits: z.string().optional(),
  allow_ips: z.string().nullable().optional(),
  group: z.string().optional(),
  cross_group_retry: z.boolean().optional(),
  allow_user_quota_query: z.boolean().optional(),
  auto_groups: z.array(z.string()).nullable().optional().transform((groups) => groups ?? undefined),
})

export function pageSchema<T>(item: z.ZodType<T>) {
  return z.object({
    page: integer.positive(),
    page_size: integer.positive(),
    total: nonnegative,
    // Go nil slices are encoded as null; missing items is still a contract error.
    items: z.array(item).nullable().transform((items) => items ?? []),
  })
}

export const logSchema: z.ZodType<UsageLog> = z.object({
  id: integer.nonnegative(),
  created_at: integer.positive(),
  type: integer,
  model_name: z.string().optional(),
  token_name: z.string().optional(),
  quota: number.optional(),
  prompt_tokens: nonnegative.optional(),
  completion_tokens: nonnegative.optional(),
  use_time: number.optional(),
  is_stream: z.boolean().optional(),
  group: z.string().optional(),
  content: z.string().optional(),
  ip: z.string().optional(),
  request_id: z.string().optional(),
  // A JSON string on the wire; malformed or missing metadata becomes `{}`.
  other: z.string().optional().transform(parseLogOther),
})

export const statSchema: z.ZodType<UsageStat> = z.object({ quota: number, rpm: number, tpm: number })

/** /api/data/self rows: hourly per-model aggregates. Only the fields used. */
export const quotaDataSchema = z.object({
  created_at: integer.positive(),
  token_used: nonnegative,
})

export const loginSessionSchema: z.ZodType<LoginSession> = z.object({
  sid: z.string().min(1),
  current: z.boolean().optional(),
  login_method: z.string().optional(),
  ip: z.string().optional(),
  user_agent: z.string().optional(),
  created_at: integer.optional(),
  last_active_at: integer.optional(),
  expires_at: integer.optional(),
})

export const groupsSchema: z.ZodType<UserGroups> = z.record(z.string(), z.object({
  desc: z.string().optional(),
  ratio: z.union([number, z.literal('auto')]).optional(),
}))

export const keyRequestSchema: z.ZodType<CreateKeyRequest> = z.object({
  name: z.string().trim().min(1).refine((name) => new TextEncoder().encode(name).length <= 50),
  expired_time: integer.refine((value) => value === -1 || value > 0),
  // Usage keeps decrementing remain_quota on unlimited keys, so it can be
  // negative there; the server only bounds it for limited keys.
  remain_quota: integer,
  unlimited_quota: z.boolean(),
  model_limits_enabled: z.boolean(),
  model_limits: z.string(),
  group: z.string().min(1),
  allow_ips: z.string().nullable().optional(),
  cross_group_retry: z.boolean().optional(),
  allow_user_quota_query: z.boolean().optional(),
  auto_groups: z.array(z.string()).optional(),
}).refine((key) => key.unlimited_quota || key.remain_quota >= 0)

export function parseData<T>(schema: z.ZodType<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    // Paths are safe diagnostics; zod issues may carry sensitive input, so never expose them.
    const fields = result.error.issues.slice(0, 3).map((issue) => issue.path.join('.') || 'data').join('、')
    throw new ApiError(`${label}的数据结构与当前接口契约不一致（${fields}），请检查部署版本。`, 200, 'INVALID_RESPONSE')
  }
  return result.data
}
