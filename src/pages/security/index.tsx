import { InfoCard } from "@/components/info-card"
import { PageHeading } from "@/components/page-heading"
import { RefreshButton } from "@/components/refresh-button"
import { Skeleton } from "@/components/ui/skeleton"
import { useLoginSessions, useSelf } from "@/hooks/use-queries"
import { roleText, statusText } from "@/utils/account"

import { LoginAuthCard } from "./login-auth-card"
import { SessionsCard } from "./sessions-card"

export default function SecurityPage() {
  const self = useSelf()
  const sessions = useLoginSessions()
  const user = self.data
  const fetching = self.isFetching || sessions.isFetching

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="安全设置">
        <RefreshButton
          fetching={fetching}
          label="刷新"
          onRefresh={() => {
            void self.refetch()
            void sessions.refetch()
          }}
        />
      </PageHeading>

      <div className="grid gap-6 lg:grid-cols-2">
        <LoginAuthCard user={user} loading={self.isPending} />
        {self.isPending ? (
          <Skeleton className="h-56 rounded-3xl bg-card" />
        ) : (
          <InfoCard
            title="账户安全"
            rows={[
              ["登录用户名", user?.username ?? "—"],
              ["账号状态", statusText(user?.status)],
              ["账户角色", roleText(user?.role)],
              [
                "密码状态",
                user?.has_password === undefined
                  ? "未提供"
                  : user.has_password
                    ? "已设置"
                    : "未设置",
              ],
            ]}
          />
        )}
      </div>

      <SessionsCard sessions={sessions} />
    </div>
  )
}
