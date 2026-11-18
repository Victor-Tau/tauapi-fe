import { z } from 'zod'
import { ApiError } from './errors'
import type { UsageLogFilters } from '@/types/api'

export function queryString(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value))
  }
  const value = query.toString()
  return value ? `?${value}` : ''
}

export function validateFilters(filters: UsageLogFilters): UsageLogFilters {
  const schema = z.object({
    p: z.number().int().positive().optional(),
    page_size: z.number().int().min(1).max(100).optional(),
    type: z.number().int().optional(),
    start_timestamp: z.number().int().positive().optional(),
    end_timestamp: z.number().int().positive().optional(),
    model_name: z.string().trim().max(200).optional(),
    token_name: z.string().trim().max(200).optional(),
    group: z.string().trim().optional(),
  }).refine((value) => value.start_timestamp === undefined || value.end_timestamp === undefined || value.start_timestamp <= value.end_timestamp)
  const result = schema.safeParse(filters)
  if (!result.success) throw new ApiError('筛选条件无效，请检查页码与起止日期。', 400, 'INVALID_FILTER')
  return result.data
}
