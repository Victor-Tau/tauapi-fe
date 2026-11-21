import { type ComponentProps, type ReactNode } from "react"

import { InfoCard } from "@/components/info-card"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { SelfProfile } from "@/types/api"
import { statusText } from "@/utils/account"
import { formatUnixSeconds } from "@/utils/format"
import { accountSpecial, STUDENT_GROUP, type VipTier } from "@/utils/vip"

import { VipBadge } from "./vip-badges"

/** Account details: names, UID, email, registration, status, VIP, student. */
export function AccountInfoCard({
  user,
  tier,
}: {
  user: SelfProfile
  /** Undefined for an admin-managed custom group. */
  tier: VipTier | undefined
}) {
  const student = accountSpecial(user) === STUDENT_GROUP
  return (
    <InfoCard
      title="账户信息"
      rows={[
        ["显示名称", user.display_name || "—"],
        ["用户名", user.username],
        ["UID", `#${user.id}`],
        ["邮箱", user.email || "未绑定"],
        ["注册时间", formatUnixSeconds(user.created_at)],
        [
          "账户状态",
          <Badge
            key="status"
            variant={
              user.status === 1
                ? "success"
                : user.status === 2
                  ? "neutral"
                  : "outline"
            }
          >
            {statusText(user.status)}
          </Badge>,
        ],
        [
          "VIP 等级",
          tier ? (
            <VipBadge key="vip" tier={tier} />
          ) : (
            <span key="vip" className="text-muted-foreground">
              自定义分组
            </span>
          ),
        ],
        [
          "大学生认证",
          <Badge
            key="student"
            variant="neutral"
            className={student ? "bg-info-text/12 text-info-text" : undefined}
          >
            {student ? "已认证" : "未认证"}
          </Badge>,
        ],
      ]}
    />
  )
}

function GitHubLogo(props: ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.82-.26.82-.57v-2c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.63-5.48 5.92.42.36.81 1.1.81 2.22v3.29c0 .32.21.7.82.58A12 12 0 0 0 12 .3" />
    </svg>
  )
}

function GoogleLogo(props: ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...props}>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.88-3.02c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.28a7.2 7.2 0 0 1 0-4.56V6.61H1.27a12 12 0 0 0 0 10.78z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.6 4.59 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.27 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77"
      />
    </svg>
  )
}

function LinuxDoLogo(props: ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...props}>
      <clipPath id="linuxdo-clip">
        <circle cx="12" cy="12" r="11" />
      </clipPath>
      <g clipPath="url(#linuxdo-clip)">
        <rect width="24" height="8" fill="#1c1c1e" />
        <rect y="8" width="24" height="8" fill="#f0f0f0" />
        <rect y="16" width="24" height="8" fill="#ffb003" />
      </g>
      <circle
        cx="12"
        cy="12"
        r="11"
        fill="none"
        stroke="currentColor"
        strokeOpacity=".12"
      />
    </svg>
  )
}

const PROVIDERS: {
  key: string
  name: string
  logo: (props: ComponentProps<"svg">) => ReactNode
  id: (user: SelfProfile) => string | undefined
}[] = [
  { key: "github", name: "GitHub", logo: GitHubLogo, id: (u) => u.github_id },
  { key: "google", name: "Google", logo: GoogleLogo, id: (u) => u.google_id },
  {
    key: "linuxdo",
    name: "LinuxDO",
    logo: LinuxDoLogo,
    id: (u) => u.linux_do_id,
  },
]

/** Third-party accounts linked for sign-in. */
export function BindingsCard({ user }: { user: SelfProfile }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>第三方绑定</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col">
          {PROVIDERS.map(({ key, name, logo: Logo, id }, index) => {
            const bound = Boolean(id(user))
            return (
              <li key={key}>
                {index > 0 && <Separator />}
                <div className="flex items-center gap-3 py-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-nav-active">
                    <Logo className="size-5" />
                  </div>
                  <span className="flex-1 font-medium">{name}</span>
                  <Badge variant={bound ? "success" : "neutral"}>
                    {bound ? "已绑定" : "未绑定"}
                  </Badge>
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
