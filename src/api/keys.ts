import { z } from 'zod'
import { apiClient } from './request'
import { ApiError } from './errors'
import { keyRequestSchema, pageSchema, parseData, tokenSchema } from './schema'
import { queryString, validateFilters } from './shared'
import { toRelayKey } from '@/utils/format'
import type { CreateKeyRequest, ModelApiToken, UpdateKeyRequest } from '@/types/api'

function keyPath(id: number): string {
  if (!Number.isSafeInteger(id) || id <= 0) throw new ApiError('密钥 ID 无效。', 400, 'INVALID_KEY_ID')
  return `/api/token/${id}`
}

export async function listKeys(params: { p?: number; page_size?: number } = {}, signal?: AbortSignal) {
  const filters = validateFilters(params)
  return parseData(pageSchema(tokenSchema), await apiClient.request(`/api/token/${queryString({ p: filters.p ?? 1, page_size: filters.page_size })}`, { signal }), '密钥列表')
}

/** The server caps `page_size` at 100 (common/page_info.go). */
const KEY_PAGE_MAX = 100
/** Safety stop for runaway paging: 50 pages = 5000 keys. */
const KEY_PAGES_LIMIT = 50

/** Every key on the account, paging through the list. */
export async function listAllKeys(signal?: AbortSignal): Promise<ModelApiToken[]> {
  const keys: ModelApiToken[] = []
  for (let page = 1; page <= KEY_PAGES_LIMIT; page++) {
    const result = await listKeys({ p: page, page_size: KEY_PAGE_MAX }, signal)
    keys.push(...result.items)
    if (!result.items.length || page * result.page_size >= result.total) break
  }
  return keys
}

/** Names of every key on the account (for filters), de-duplicated and sorted. */
export async function listAllKeyNames(signal?: AbortSignal): Promise<string[]> {
  const names = new Set<string>()
  for (const key of await listAllKeys(signal)) if (key.name) names.add(key.name)
  return [...names].sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

export async function getKey(id: number, signal?: AbortSignal) {
  return parseData(tokenSchema, await apiClient.request(keyPath(id), { signal }), '密钥详情')
}

export async function createKey(input: CreateKeyRequest): Promise<void> {
  const result = keyRequestSchema.safeParse(input)
  if (!result.success) throw new ApiError('密钥配置无效，请检查名称、有效期、额度和分组。名称最多 50 字节。', 400, 'INVALID_KEY_INPUT')
  await apiClient.request('/api/token/', { method: 'POST', body: result.data })
}

export async function updateKey(input: UpdateKeyRequest): Promise<void> {
  keyPath(input.id)
  const result = keyRequestSchema.safeParse(input)
  if (!result.success) throw new ApiError('密钥配置不完整，无法安全保存。请重新读取详情。', 400, 'INVALID_KEY_INPUT')
  await apiClient.request('/api/token/', { method: 'PUT', body: { ...result.data, id: input.id } })
}

export async function setKeyStatus(id: number, status: 1 | 2): Promise<void> {
  keyPath(id)
  if (status !== 1 && status !== 2) throw new ApiError('密钥状态无效。', 400, 'INVALID_KEY_STATUS')
  await apiClient.request('/api/token/?status_only=true', { method: 'PUT', body: { id, status } })
}

export async function deleteKey(id: number): Promise<void> {
  await apiClient.request(keyPath(id), { method: 'DELETE' })
}

/** Call only from an explicit show/copy gesture. */
export async function revealKey(id: number, signal?: AbortSignal): Promise<string> {
  const result = parseData(z.object({ key: z.string().min(1) }), await apiClient.request(`${keyPath(id)}/key`, { method: 'POST', signal }), '密钥')
  return toRelayKey(result.key)
}
