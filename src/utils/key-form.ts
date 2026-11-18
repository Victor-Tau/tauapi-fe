import type { CreateKeyRequest, ModelApiToken, UpdateKeyRequest } from '@/types/api'

export interface KeyFormValues {
  name: string
  expiration: 'never' | 'custom'
  expiresAt: string
  unlimited: boolean
  remainingQuota: string
  group: string
  restrictModels: boolean
  models: string
  allowIps: string
}

export type KeyFormErrors = Partial<Record<keyof KeyFormValues, string>>

export function toLocalDateTime(seconds: number): string {
  const date = new Date(seconds * 1000)
  if (!Number.isFinite(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export function getKeyFormDefaults(token?: ModelApiToken): KeyFormValues {
  return {
    name: token?.name ?? '',
    expiration: token?.expired_time != null && token.expired_time > 0 ? 'custom' : 'never',
    expiresAt: token?.expired_time != null && token.expired_time > 0 ? toLocalDateTime(token.expired_time) : '',
    unlimited: token?.unlimited_quota ?? true,
    remainingQuota: String(token?.remain_quota ?? 0),
    group: token?.group ?? '',
    restrictModels: token?.model_limits_enabled ?? false,
    models: token?.model_limits ?? '',
    allowIps: token?.allow_ips ?? '',
  }
}

function validIpOrCidr(input: string): boolean {
  const [address, prefix, ...rest] = input.split('/')
  if (rest.length > 0 || !address) return false
  const isV4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(address) && address.split('.').every(part => Number(part) <= 255)
  // URL performs browser-native IPv6 address validation, including compressed forms.
  let isV6 = false
  if (address.includes(':')) {
    try {
      const parsed = new URL(`http://[${address}]/`)
      isV6 = parsed.hostname.startsWith('[')
    } catch { isV6 = false }
  }
  if (!isV4 && !isV6) return false
  if (prefix === undefined) return true
  return /^\d{1,3}$/.test(prefix) && Number(prefix) <= (isV4 ? 32 : 128)
}

export function validateKeyForm(values: KeyFormValues, allowedGroups: readonly string[], now = Date.now()): KeyFormErrors {
  const errors: KeyFormErrors = {}
  if (!values.name.trim()) errors.name = '请为密钥填写一个名称'
  else if (new TextEncoder().encode(values.name.trim()).length > 50) errors.name = '名称最多 50 字节（约 16 个中文字符）'
  if (!values.group || !allowedGroups.includes(values.group)) errors.group = '请选择服务器返回的可用分组'
  if (values.expiration === 'custom') {
    const timestamp = new Date(values.expiresAt).getTime()
    if (!values.expiresAt || !Number.isFinite(timestamp)) errors.expiresAt = '请选择有效的到期时间'
    else if (timestamp <= now) errors.expiresAt = '到期时间必须晚于当前时间'
  }
  if (!values.unlimited && (!/^\d+$/.test(values.remainingQuota.trim()) || !Number.isSafeInteger(Number(values.remainingQuota)))) {
    errors.remainingQuota = '请输入非负整数额度（内部 quota 单位）'
  }
  if (values.restrictModels && values.models.split(',').filter(value => value.trim()).length === 0) {
    errors.models = '启用模型限制后，请至少填写一个模型名称'
  }
  const addresses = values.allowIps.split(/[\n,]/).map(value => value.trim()).filter(Boolean)
  if (addresses.some(value => !validIpOrCidr(value))) errors.allowIps = '请输入有效的 IPv4、IPv6 或 CIDR 地址，每行一个'
  return errors
}

export function createKeyPayload(values: KeyFormValues): CreateKeyRequest {
  const models = [...new Set(values.models.split(',').map(value => value.trim()).filter(Boolean))]
  return {
    name: values.name.trim(),
    expired_time: values.expiration === 'never' ? -1 : Math.floor(new Date(values.expiresAt).getTime() / 1000),
    unlimited_quota: values.unlimited,
    remain_quota: Number(values.remainingQuota) || 0,
    group: values.group,
    model_limits_enabled: values.restrictModels,
    model_limits: models.join(','),
    allow_ips: values.allowIps.split(/[\n,]/).map(value => value.trim()).filter(Boolean).join('\n'),
  }
}

export function updateKeyPayload(values: KeyFormValues, original: ModelApiToken): UpdateKeyRequest {
  return {
    ...createKeyPayload(values),
    id: original.id,
    expired_time: values.expiration === 'custom' && original.expired_time != null && values.expiresAt === toLocalDateTime(original.expired_time)
      ? original.expired_time
      : createKeyPayload(values).expired_time,
    ...(original.auto_groups !== undefined ? { auto_groups: original.auto_groups } : {}),
    ...(original.cross_group_retry !== undefined ? { cross_group_retry: original.cross_group_retry } : {}),
    ...(original.allow_user_quota_query !== undefined ? { allow_user_quota_query: original.allow_user_quota_query } : {}),
  }
}

/**
 * Same key, new group. Every other field is sent back unchanged; call only
 * with a token that passed `canEditKey`.
 */
export function regroupKeyPayload(token: ModelApiToken, group: string): UpdateKeyRequest {
  return {
    id: token.id,
    name: token.name,
    expired_time: token.expired_time != null && token.expired_time > 0 ? token.expired_time : -1,
    // Unlimited keys keep their (possibly negative) counter as is; a limited
    // key overdrawn below zero is exhausted either way and the server rejects
    // negative limits.
    remain_quota: token.unlimited_quota ? (token.remain_quota ?? 0) : Math.max(0, token.remain_quota ?? 0),
    unlimited_quota: token.unlimited_quota ?? true,
    model_limits_enabled: token.model_limits_enabled ?? false,
    model_limits: token.model_limits ?? '',
    allow_ips: token.allow_ips ?? '',
    group,
    ...(token.auto_groups !== undefined ? { auto_groups: token.auto_groups } : {}),
    ...(token.cross_group_retry !== undefined ? { cross_group_retry: token.cross_group_retry } : {}),
    ...(token.allow_user_quota_query !== undefined ? { allow_user_quota_query: token.allow_user_quota_query } : {}),
  }
}

/** Editing must never turn missing server fields into destructive defaults. */
export function canEditKey(token: ModelApiToken): boolean {
  return typeof token.expired_time === 'number'
    && typeof token.unlimited_quota === 'boolean'
    && typeof token.remain_quota === 'number'
    && typeof token.model_limits_enabled === 'boolean'
    && typeof token.model_limits === 'string'
    && typeof token.group === 'string'
    && (typeof token.allow_ips === 'string' || token.allow_ips === null)
    && (token.group !== 'auto' || typeof token.cross_group_retry === 'boolean')
}

export function keyStatus(status: number): { label: string; tone: 'lime' | 'gray' | 'rose' | 'orange' } {
  if (status === 1) return { label: '已启用', tone: 'lime' }
  if (status === 2) return { label: '已停用', tone: 'gray' }
  if (status === 3) return { label: '已过期', tone: 'orange' }
  if (status === 4) return { label: '额度耗尽', tone: 'rose' }
  return { label: `状态 ${status}`, tone: 'gray' }
}
