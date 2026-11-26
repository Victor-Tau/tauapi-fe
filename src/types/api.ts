import type { LogOther } from '@/utils/log-other'

/** Public, validated data shapes. No management JWT is exposed to components. */
export interface SelfProfile {
  id: number
  username: string
  display_name?: string
  email?: string
  role?: number
  status?: number
  group?: string
  quota?: number
  used_quota?: number
  request_count?: number
  has_password?: boolean
  /** Third-party account IDs; empty when not bound. */
  github_id?: string
  google_id?: string
  linux_do_id?: string
  /** Registration time, Unix seconds. */
  created_at?: number
  /** Effective VIP level 0–5; null when an admin-managed custom group (e.g. svip). */
  vip_level?: number | null
  /** Custom Pebble avatar; null/undefined = the default picked from the user ID. */
  pebble?: PebbleConfig | null
  /** The user's own affiliate code; empty until generated. */
  aff_code?: string
  /** Number of users registered with this account's code. */
  aff_count?: number
  /** Total registration bonus earned by inviting users (raw quota). */
  aff_history_quota?: number
}

/** A saved Pebble avatar (`users.setting.pebble`); index meanings live in pebble-avatar.tsx. */
export interface PebbleConfig {
  trait: number
  eyes: number
  palette: number
  blush: boolean
}

/** One VIP tier as published in `/api/status`. */
export interface StatusVipTier {
  level: number
  key: string
  name: string
  min_amount: number
  /** `TopupGroupRatio` of the tier: paid = amount × price × ratio. */
  topup_ratio: number
}

/** `GET /api/user/self/growth`. */
export interface SelfGrowth {
  window_days: number
  /** Growth value (quota / quota_per_unit). */
  amount: number
  /** Effective level on the account; null for a custom group. */
  level: number | null
  next: { level: number; min_amount: number } | null
  records: { items: GrowthEvent[]; total: number }
}

export interface GrowthEvent {
  id: number
  quota: number
  amount: number
  /** "topup" | "redemption" | "admin_adjustment" */
  source: string
  created_at: number
}

export interface SiteStatus {
  version?: string
  system_name?: string
  quota_per_unit?: number
  quota_display_type?: string
  display_in_currency?: boolean
  usd_exchange_rate?: number
  custom_currency_exchange_rate?: number
  custom_currency_symbol?: string
  password_login_enabled?: boolean
  password_login_encryption_enabled?: boolean
  turnstile_check?: boolean
  turnstile_site_key?: string
  register_enabled?: boolean
  password_register_enabled?: boolean
  email_verification?: boolean
  log_max_range_days?: number
  enable_data_export?: boolean
  data_export_default_time?: string
  announcements_enabled?: boolean
  announcements?: Announcement[]
  vip_tiers?: StatusVipTier[]
  growth_window_days?: number
}

/** An entry of the admin console's announcement list (`/api/status`). */
export interface Announcement {
  id?: number | string
  /** Markdown in the upstream console; shown here as plain text. */
  content: string
  /** ISO date string. */
  publishDate?: string
  /** default | ongoing | success | warning | error */
  type?: string
  extra?: string
}

export interface ModelApiToken {
  id: number
  name: string
  /** Preview only ("sk-abcd••••wxyz"); the response adapter drops the rest. */
  key?: string
  status: number
  created_time?: number
  accessed_time?: number
  expired_time?: number
  remain_quota?: number
  used_quota?: number
  unlimited_quota?: boolean
  model_limits_enabled?: boolean
  model_limits?: string
  allow_ips?: string | null
  group?: string
  cross_group_retry?: boolean
  allow_user_quota_query?: boolean
  auto_groups?: string[]
}

export interface PageData<T> {
  page: number
  page_size: number
  total: number
  items: T[]
}

export interface CreateKeyRequest {
  name: string
  expired_time: number
  remain_quota: number
  unlimited_quota: boolean
  model_limits_enabled: boolean
  model_limits: string
  group: string
  allow_ips?: string | null
  cross_group_retry?: boolean
  allow_user_quota_query?: boolean
  auto_groups?: string[]
}

export interface UpdateKeyRequest extends CreateKeyRequest {
  id: number
}

export interface UsageLog {
  id: number
  created_at: number
  type: number
  model_name?: string
  token_name?: string
  quota?: number
  prompt_tokens?: number
  completion_tokens?: number
  use_time?: number
  is_stream?: boolean
  group?: string
  content?: string
  /** Caller IP; only recorded when the user enabled IP logging. */
  ip?: string
  request_id?: string
  /** Structured metadata, see `parseLogOther` (utils/log-other.ts). */
  other?: LogOther
}

export interface UsageStat {
  quota: number
  /** Recent rate: requests/minute. Not a cumulative request count. */
  rpm: number
  /** Recent rate: tokens/minute. Not a cumulative token count. */
  tpm: number
}

export interface UsageLogFilters {
  p?: number
  page_size?: number
  type?: number
  start_timestamp?: number
  end_timestamp?: number
  model_name?: string
  token_name?: string
  group?: string
}

export interface LoginEncryptionInfo {
  enabled: boolean
  kid?: string
  public_key?: string
}

export type UserGroups = Record<string, { desc?: string; ratio?: number | 'auto' }>

export interface LoginInput {
  username: string
  password: string
  turnstileToken?: string
}

export interface DateRange {
  start_timestamp: number
  end_timestamp: number
}

/** One entry of `GET /api/pricing` `data`. Prices are not in quota units. */
export interface PricingModel {
  model_name: string
  description?: string
  icon?: string
  tags?: string
  vendor_id?: number
  /** 0 = per token (ratio), 1 = per request (model_price, USD). */
  quota_type: number
  model_ratio: number
  model_price: number
  completion_ratio: number
  cache_ratio?: number | null
  create_cache_ratio?: number | null
  enable_groups: string[]
  supported_endpoint_types: string[]
  /** "tiered_expr" uses `billing_expr`; otherwise the legacy ratio fields apply. */
  billing_mode?: string
  billing_expr?: string
}

export interface PricingVendor {
  id: number
  name: string
  icon?: string
  description?: string
}

export interface PricingCatalog {
  models: PricingModel[]
  vendors: PricingVendor[]
  /** What this user pays per group (user-group special ratios applied). */
  group_ratio: Record<string, number>
  /**
   * The groups' own ratios, before any special ratio for the user's group
   * (from the anonymous catalog). Empty when that could not be read.
   */
  base_group_ratio: Record<string, number>
  /** Groups the current user may use (values are descriptions, often empty). */
  usable_group: Record<string, string>
  supported_endpoint: Record<string, { path: string; method: string }>
}

export interface ModelPerfSummary {
  model_name: string
  avg_latency_ms: number
  /** Percent, 0–100. */
  success_rate: number
  avg_tps: number
  recent_success_series: { ts: number; success_rate: number }[]
}

export interface PerfMetricsSummary {
  summary: { avg_latency_ms: number; success_rate: number; avg_tps: number } | null
  window_start?: number
  window_end?: number
  models: ModelPerfSummary[]
}

/** A login session of the current user (`/api/user/sessions`). */
export interface LoginSession {
  sid: string
  current?: boolean
  login_method?: string
  ip?: string
  user_agent?: string
  /** Unix seconds. */
  created_at?: number
  last_active_at?: number
  expires_at?: number
}
