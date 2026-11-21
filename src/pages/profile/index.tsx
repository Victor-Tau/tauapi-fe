import { useState } from "react"

import { PageHeading } from "@/components/page-heading"
import { RefreshButton } from "@/components/refresh-button"
import { AvatarFrame } from "@/components/avatar-frame"
import { PebbleAvatar } from "@/components/pebble-avatar"
import { ErrorAlert } from "@/components/error-alert"
import { Card, CardContent, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useDailyTokens,
  useSelf,
  useSiteStatus,
  useVipConfig,
} from "@/hooks/use-queries"
import { activityStart, activityStats } from "@/utils/activity"
import { accountTier, frameBadge } from "@/utils/vip"

import { AccountInfoCard, BindingsCard } from "./account-cards"
import { ActivityHeatmap } from "./activity-heatmap"
import { ActivityStatsStrip } from "./activity-stats"
import { DisplayNameEditor } from "./display-name-editor"
import { PebbleEditor } from "./pebble-editor"

export default function ProfilePage() {
  const self = useSelf()
  const site = useSiteStatus()
  const { tiers } = useVipConfig()
  const user = self.data
  const config = site.data
  // Fixed for the visit: the heatmap starts on the Monday 52 weeks back.
  const [start] = useState(() => Math.floor(activityStart().getTime() / 1000))
  // The server's range limit sets the request windows, so wait for it.
  const daily = useDailyTokens(
    start,
    config?.log_max_range_days,
    site.isSuccess
  )
  const stats = daily.data ? activityStats(daily.data) : undefined
  const fetching = self.isFetching || daily.isFetching
  const tier = accountTier(user, tiers)

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="个人资料">
        <RefreshButton
          fetching={fetching}
          label="刷新资料"
          onRefresh={() => {
            void self.refetch()
            void site.refetch()
            void daily.refetch()
          }}
        />
      </PageHeading>

      {daily.isError && (
        <ErrorAlert
          error={daily.error}
          onRetry={() => void daily.refetch()}
          retrying={daily.isFetching}
        />
      )}

      {self.isPending ? (
        <div className="flex flex-col gap-6">
          <Skeleton className="h-32 w-full rounded-3xl bg-card" />
          <Skeleton className="h-64 w-full rounded-3xl bg-card" />
        </div>
      ) : user ? (
        <>
          <Card>
            <CardContent className="flex flex-col gap-6 lg:flex-row lg:items-center">
              <div className="flex min-w-0 items-center gap-4 lg:w-64 lg:shrink-0">
                <PebbleEditor user={user}>
                  <AvatarFrame level={user.vip_level} badge={frameBadge(user)}>
                    <PebbleAvatar
                      id={user.id}
                      pebble={user.pebble}
                      className="size-14"
                    />
                  </AvatarFrame>
                </PebbleEditor>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <DisplayNameEditor user={user} />
                  <CardDescription className="tabular-nums">
                    UID #{user.id}
                  </CardDescription>
                </div>
              </div>
              <ActivityStatsStrip
                stats={stats}
                loading={!daily.data && !daily.isError}
              />
            </CardContent>
          </Card>

          <ActivityHeatmap
            tokens={daily.data}
            loading={!daily.data && !daily.isError}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <AccountInfoCard user={user} tier={tier} />
            <BindingsCard user={user} />
          </div>
        </>
      ) : null}
    </div>
  )
}
