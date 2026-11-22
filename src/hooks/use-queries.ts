import { useMemo } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { listAllKeyNames, listAllKeys, listKeys } from "@/api/keys"
import { getPerfMetricsSummary, getPricing } from "@/api/pricing"
import { getTwoFAStatus } from "@/api/security"
import {
  getOwnDailyTokens,
  getOwnTokenTrend,
  getOwnUsageStat,
  listBalanceLogs,
  listOwnLogs,
  sumOwnLogs,
  type TrendUnit,
} from "@/api/usage"
import {
  getLoginSessions,
  getSelf,
  getSelfGroups,
  getSelfGrowth,
  getStatus,
  getUserModels,
  getTopUpLink,
} from "@/api/user"
import {
  isAwaitingCredit,
  getAffCode,
  getReferralPermissions,
  listInvitees,
  listAllRebates,
} from "@/api/referral"
import { queryKeys } from "@/lib/query"
import type { DateRange, UsageLogFilters } from "@/types/api"
import { growthWindowDays, vipTiers } from "@/utils/vip"

/** Requested page sizes; the server's `page_size` in each response wins. */
export const KEYS_PAGE_SIZE = 10
export const LOGS_PAGE_SIZE = 10

export function useSiteStatus(
  { refetchOnMount }: { refetchOnMount?: "always" } = {}
) {
  return useQuery({
    queryKey: queryKeys.status,
    queryFn: ({ signal }) => getStatus(signal),
    staleTime: 5 * 60_000,
    refetchOnMount,
  })
}

export function useSelf() {
  return useQuery({
    queryKey: queryKeys.self,
    queryFn: ({ signal }) => getSelf(signal),
  })
}

export function useTopUpLink() {
  return useQuery({
    queryKey: queryKeys.topUpLink,
    queryFn: ({ signal }) => getTopUpLink(signal),
    staleTime: 5 * 60_000,
  })
}

export function useSelfGroups(enabled = true) {
  return useQuery({
    queryKey: queryKeys.groups,
    queryFn: ({ signal }) => getSelfGroups(signal),
    staleTime: 5 * 60_000,
    enabled,
  })
}

export function useUserModels(enabled = true) {
  return useQuery({
    queryKey: queryKeys.models,
    queryFn: ({ signal }) => getUserModels(undefined, signal),
    staleTime: 5 * 60_000,
    enabled,
  })
}

export function useKeys(page: number, pageSize?: number) {
  return useQuery({
    queryKey: queryKeys.keys(page, pageSize),
    queryFn: ({ signal }) => listKeys({ p: page, page_size: pageSize }, signal),
    placeholderData: keepPreviousData,
  })
}

/** Every key name on the account, for the usage filter. */
export function useKeyNames() {
  return useQuery({
    queryKey: queryKeys.keyNames,
    queryFn: ({ signal }) => listAllKeyNames(signal),
    staleTime: 60_000,
  })
}

/** Every key on the account (the wallet's spend per key). */
export function useAllKeys() {
  return useQuery({
    queryKey: queryKeys.keysEvery,
    queryFn: ({ signal }) => listAllKeys(signal),
  })
}

export function useLogs(filters: UsageLogFilters) {
  return useQuery({
    queryKey: queryKeys.logs(filters),
    queryFn: ({ signal }) => listOwnLogs(filters, signal),
    placeholderData: keepPreviousData,
  })
}

export function useUsageStat(filters: UsageLogFilters, enabled = true) {
  return useQuery({
    queryKey: queryKeys.usageStat(filters),
    queryFn: ({ signal }) => getOwnUsageStat(filters, signal),
    placeholderData: keepPreviousData,
    enabled,
  })
}

/** Token and request totals computed from the period's call details. */
export function useLogTotals(filters: UsageLogFilters) {
  return useQuery({
    queryKey: queryKeys.logTotals(filters),
    queryFn: ({ signal }) => sumOwnLogs(filters, signal),
    placeholderData: keepPreviousData,
  })
}

/** Input/output/cache tokens per hour or day, summed from the call details. */
export function useTokenTrend(range: DateRange, unit: TrendUnit) {
  return useQuery({
    queryKey: queryKeys.tokenTrend(range, unit),
    queryFn: ({ signal }) => getOwnTokenTrend(range, unit, signal),
    placeholderData: keepPreviousData,
  })
}

export function usePricing() {
  return useQuery({
    queryKey: queryKeys.pricing,
    queryFn: ({ signal }) => getPricing(signal),
    staleTime: 5 * 60_000,
  })
}

export function usePerfSummary(hours = 24) {
  return useQuery({
    queryKey: queryKeys.perfSummary(hours),
    queryFn: ({ signal }) => getPerfMetricsSummary(hours, signal),
    staleTime: 60_000,
  })
}

/**
 * Tokens per local day since `startTimestamp` (the activity heatmap). Runs
 * once the site status is known, since its range limit sets the windows.
 */
export function useDailyTokens(
  startTimestamp: number,
  maxRangeDays: number | undefined,
  enabled: boolean
) {
  return useQuery({
    queryKey: queryKeys.dailyTokens(startTimestamp, maxRangeDays),
    queryFn: ({ signal }) =>
      getOwnDailyTokens(startTimestamp, maxRangeDays, signal),
    staleTime: 10 * 60_000,
    enabled,
  })
}

/** The site's VIP tiers and growth window (built-in defaults until `/api/status` loads). */
export function useVipConfig() {
  const site = useSiteStatus()
  const config = site.data
  const tiers = useMemo(() => vipTiers(config), [config])
  return { tiers, windowDays: growthWindowDays(config) }
}

/** Growth value, effective level and one page of growth records (server-side). */
export function useGrowth(page: number, pageSize: number) {
  return useQuery({
    queryKey: queryKeys.growth(page, pageSize),
    queryFn: ({ signal }) => getSelfGrowth(page, pageSize, signal),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}

export function useLoginSessions() {
  return useQuery({
    queryKey: queryKeys.sessions,
    queryFn: ({ signal }) => getLoginSessions(signal),
  })
}

export function useTwoFAStatus() {
  return useQuery({
    queryKey: queryKeys.twoFA,
    queryFn: ({ signal }) => getTwoFAStatus(signal),
  })
}

export function useBalanceLogs(filters: {
  p: number
  page_size: number
  type: number
}) {
  return useQuery({
    queryKey: queryKeys.balanceLogs(filters),
    queryFn: ({ signal }) => listBalanceLogs(filters, signal),
    placeholderData: keepPreviousData,
  })
}

export function useReferralPermissions() {
  return useQuery({
    queryKey: queryKeys.referralPermissions,
    queryFn: ({ signal }) => getReferralPermissions(signal),
  })
}

/** Generates a code on the server when the account has none, so only run it then. */
export function useAffCode(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.affCode,
    queryFn: ({ signal }) => getAffCode(signal),
    staleTime: Infinity,
    enabled,
  })
}

export function useInvitees(page: number, pageSize: number, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.invitees(page, pageSize),
    queryFn: ({ signal }) => listInvitees(page, pageSize, signal),
    placeholderData: keepPreviousData,
    enabled,
  })
}

/** Every referral earning (rewards and rebates), polled each minute while one awaits credit. */
export function useAllRebates(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.rebatesAll,
    queryFn: ({ signal }) => listAllRebates(signal),
    refetchInterval: (query) =>
      query.state.data?.items.some(isAwaitingCredit) ? 60_000 : false,
    enabled,
  })
}
