import { z } from 'zod'
import { apiClient } from './request'
import { parseData } from './schema'
import type { PerfMetricsSummary, PricingCatalog } from '@/types/api'

const number = z.number().finite()
const integer = number.int()
const strings = z.array(z.string()).nullable().optional().transform((items) => items ?? [])

const pricingModelSchema = z.object({
  model_name: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  tags: z.string().optional(),
  vendor_id: integer.optional(),
  quota_type: integer,
  model_ratio: number,
  model_price: number,
  completion_ratio: number,
  cache_ratio: number.nullable().optional(),
  create_cache_ratio: number.nullable().optional(),
  enable_groups: strings,
  supported_endpoint_types: strings,
  billing_mode: z.string().optional(),
  billing_expr: z.string().optional(),
})

// `GET /api/pricing` keeps vendors, group ratios and endpoints beside `data`.
const pricingSchema: z.ZodType<Omit<PricingCatalog, 'base_group_ratio'>> = z.object({
  data: z.array(pricingModelSchema).nullable(),
  vendors: z.array(z.object({ id: integer, name: z.string(), icon: z.string().optional(), description: z.string().optional() })).nullable().optional(),
  group_ratio: z.record(z.string(), number).nullable().optional(),
  usable_group: z.record(z.string(), z.string()).nullable().optional(),
  supported_endpoint: z.record(z.string(), z.object({ path: z.string(), method: z.string() })).nullable().optional(),
}).transform((value) => ({
  models: value.data ?? [],
  vendors: value.vendors ?? [],
  group_ratio: value.group_ratio ?? {},
  usable_group: value.usable_group ?? {},
  supported_endpoint: value.supported_endpoint ?? {},
}))

const perfSummarySchema: z.ZodType<PerfMetricsSummary> = z.object({
  summary: z.object({ avg_latency_ms: number, success_rate: number, avg_tps: number }).nullable().optional().transform((value) => value ?? null),
  window_start: integer.optional(),
  window_end: integer.optional(),
  models: z.array(z.object({
    model_name: z.string(),
    avg_latency_ms: number,
    success_rate: number,
    avg_tps: number,
    recent_success_series: z.array(z.object({ ts: integer, success_rate: number })).nullable().optional().transform((items) => items ?? []),
  })).nullable().optional().transform((items) => items ?? []),
})

const baseRatioSchema = z.object({
  group_ratio: z.record(z.string(), number).nullable().optional(),
})

/**
 * Signed in, the server swaps each group's ratio for the special ratio set
 * for the user's own group (e.g. a student discount), so the catalog only
 * shows the product. The anonymous catalog still carries the groups' own
 * ratios; it is optional — without it prices show as before.
 */
async function getBaseGroupRatios(signal?: AbortSignal): Promise<Record<string, number>> {
  try {
    const data = await apiClient.request('/api/pricing', { signal, envelope: true, auth: false })
    return baseRatioSchema.parse(data).group_ratio ?? {}
  } catch (error) {
    if (signal?.aborted) throw error
    return {}
  }
}

export async function getPricing(signal?: AbortSignal): Promise<PricingCatalog> {
  const [catalog, base] = await Promise.all([
    apiClient.request('/api/pricing', { signal, envelope: true }),
    getBaseGroupRatios(signal),
  ])
  return { ...parseData(pricingSchema, catalog, '模型价格'), base_group_ratio: base }
}

/** Per-model success rate, latency and throughput over the last `hours`. */
export async function getPerfMetricsSummary(hours = 24, signal?: AbortSignal) {
  return parseData(perfSummarySchema, await apiClient.request(`/api/perf-metrics/summary?hours=${hours}`, { signal }), '模型状态')
}
