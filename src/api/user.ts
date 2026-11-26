import { z } from "zod"
import { ApiError } from "./errors"
import { apiClient } from "./request"
import {
  groupsSchema,
  loginSessionSchema,
  pageSchema,
  parseData,
  selfGrowthSchema,
  selfSchema,
  statusSchema,
} from "./schema"
import { queryString } from "./shared"
import type { PebbleConfig } from "@/types/api"

export async function getStatus(signal?: AbortSignal) {
  return parseData(
    statusSchema,
    await apiClient.request("/api/status", { auth: false, signal }),
    "服务器状态"
  )
}

const topUpInfoSchema = z.object({
  topup_link: z.url({ protocol: /^https?$/ }).trim().optional().catch(undefined),
  enable_stripe_topup: z.boolean().catch(false),
  stripe_min_topup: z.number().int().nonnegative().catch(0),
  amount_options: z.array(z.number().int().positive()).catch([]),
})

export type TopUpInfo = z.infer<typeof topUpInfoSchema>

export async function getTopUpInfo(signal?: AbortSignal) {
  return parseData(
    topUpInfoSchema,
    await apiClient.request("/api/user/topup/info", { signal }),
    "充值信息"
  )
}

export async function getStripeQuote(amount: number) {
  return parseData(
    z.string().regex(/^\d+\.\d{2}$/).transform(Number).pipe(z.number().positive()),
    await apiClient.request("/api/user/stripe/amount", {
      method: "POST",
      body: { amount },
    }),
    "Stripe 报价"
  )
}

export async function createStripeCheckout(amount: number) {
  const result = parseData(
    z.object({ pay_link: z.url({ protocol: /^https$/ }) }),
    await apiClient.request("/api/user/stripe/pay", {
      method: "POST",
      body: { amount, payment_method: "stripe" },
    }),
    "Stripe 收银台"
  )
  return result.pay_link
}

const topUpOrderSchema = z.object({
  id: z.number().int(),
  money: z.number(),
  payment_provider: z.string().optional(),
  payment_method: z.string(),
  create_time: z.number().int(),
  status: z.string(),
})

export async function getRecentTopUpOrders(signal?: AbortSignal) {
  const page = parseData(
    pageSchema(topUpOrderSchema),
    await apiClient.request("/api/user/topup/self?p=1&page_size=10", { signal }),
    "充值订单"
  )
  return page.items
}

export async function getSelf(signal?: AbortSignal) {
  return parseData(
    selfSchema,
    await apiClient.request("/api/user/self", { signal }),
    "个人资料"
  )
}

export async function getUserModels(group?: string, signal?: AbortSignal) {
  const schema = z
    .array(z.string())
    .nullable()
    .transform((models) => models ?? [])
  return parseData(
    schema,
    await apiClient.request(`/api/user/models${queryString({ group })}`, {
      signal,
    }),
    "可用模型"
  )
}

/**
 * The server also lists the account's own user group (e.g. "VIP0-大学生优惠",
 * desc "User group"), which only drives pricing — keys can't target it.
 */
const USER_GROUP_DESCS = new Set(["User group", "用户分组"])

export async function getSelfGroups(signal?: AbortSignal) {
  const groups = parseData(
    groupsSchema,
    await apiClient.request("/api/user/self/groups", { signal }),
    "可用分组"
  )
  return Object.fromEntries(
    Object.entries(groups).filter(
      ([, group]) => !USER_GROUP_DESCS.has(group.desc ?? "")
    )
  )
}

/**
 * Redeems a code into this account's balance; resolves to the quota credited.
 * The server answers every failure with one generic message on purpose, so
 * an invalid, used or expired code cannot be told apart.
 */
export async function redeemCode(code: string) {
  const key = code.trim()
  if (!key) throw new ApiError("请输入兑换码。", 400, "EMPTY_REDEMPTION_CODE")
  const quota = z.number().finite()
  return parseData(
    quota,
    await apiClient.request("/api/user/topup", {
      method: "POST",
      body: { key },
    }),
    "兑换结果"
  )
}

/** Login sessions of this account; the current one is flagged by the server. */
export async function getLoginSessions(signal?: AbortSignal) {
  const schema = z
    .array(loginSessionSchema)
    .nullable()
    .transform((sessions) => sessions ?? [])
  return parseData(
    schema,
    await apiClient.request("/api/user/sessions", { signal }),
    "登录会话"
  )
}

/** Signs one of this account's sessions out (it may be the current one). */
export async function revokeLoginSession(sid: string) {
  if (!sid.trim())
    throw new ApiError("会话 ID 无效。", 400, "INVALID_SESSION_ID")
  await apiClient.request(`/api/user/sessions/${encodeURIComponent(sid)}`, {
    method: "DELETE",
  })
}

/** Renames the account's display name (the server allows at most 20 characters). */
export async function updateDisplayName(name: string) {
  const value = name.trim()
  if (!value) throw new ApiError("显示名称不能为空。", 400, "VALIDATION_ERROR")
  if ([...value].length > 20)
    throw new ApiError("显示名称最多 20 个字符。", 400, "VALIDATION_ERROR")
  await apiClient.request("/api/user/self", {
    method: "PUT",
    body: { display_name: value },
  })
}

/**
 * Growth value, effective VIP level and one page of growth records. The
 * server keeps the total itself, including admin adjustments.
 */
export async function getSelfGrowth(
  page: number,
  pageSize: number,
  signal?: AbortSignal
) {
  return parseData(
    selfGrowthSchema,
    await apiClient.request(
      `/api/user/self/growth${queryString({ p: page, page_size: pageSize })}`,
      { signal }
    ),
    "成长值"
  )
}

/** Saves the custom Pebble avatar; null restores the default picked from the user ID. */
export async function updatePebble(pebble: PebbleConfig | null) {
  await apiClient.request("/api/user/self", {
    method: "PUT",
    body: { pebble },
  })
}
