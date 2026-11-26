import { QueryClient } from "@tanstack/react-query"

import { ApiError } from "@/api/errors"
import { apiClient } from "@/api/request"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Only transport-level failures are worth repeating, and only once.
      retry: (failureCount, error) =>
        failureCount < 1 && error instanceof ApiError && error.retriable,
    },
    mutations: { retry: false },
  },
})

// Private data must never survive a change of identity.
apiClient.onIdentityChange(() => {
  void queryClient.cancelQueries()
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== "status",
  })
})

export const queryKeys = {
  status: ["status"] as const,
  self: ["self"] as const,
  topUpInfo: ["topup-info"] as const,
  topUpOrders: ["topup-orders"] as const,
  groups: ["groups"] as const,
  models: ["models"] as const,
  keys: (page: number, pageSize?: number) => ["keys", page, pageSize] as const,
  keysAll: ["keys"] as const,
  // Under the "keys" prefix: creating or deleting a key refreshes it too.
  keyNames: ["keys", "names"] as const,
  keysEvery: ["keys", "every"] as const,
  logs: (filters: object) => ["logs", filters] as const,
  usageStat: (filters: object) => ["usage-stat", filters] as const,
  logTotals: (filters: object) => ["log-totals", filters] as const,
  tokenTrend: (range: object, unit: string) =>
    ["token-trend", range, unit] as const,
  dailyTokens: (start: number, maxDays?: number) =>
    ["daily-tokens", start, maxDays] as const,
  sessions: ["sessions"] as const,
  twoFA: ["two-fa"] as const,
  balanceLogs: (filters: object) => ["balance-logs", filters] as const,
  growth: (page: number, pageSize: number) =>
    ["growth", page, pageSize] as const,
  growthAll: ["growth"] as const,
  pricing: ["pricing"] as const,
  // Under one prefix, so the page refresh reloads all referral data.
  referralAll: ["referral"] as const,
  referralPermissions: ["referral", "permissions"] as const,
  affCode: ["referral", "aff-code"] as const,
  invitees: (page: number, pageSize: number) =>
    ["referral", "invitees", page, pageSize] as const,
  rebatesAll: ["referral", "rebates"] as const,
  perfSummary: (hours: number) => ["perf-summary", hours] as const,
}
