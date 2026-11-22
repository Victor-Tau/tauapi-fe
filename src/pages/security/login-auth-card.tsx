import { useState } from "react"
import { useSearchParams } from "react-router"
import { KeyRoundIcon, MailIcon, ShieldCheckIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useTwoFAStatus } from "@/hooks/use-queries"
import type { SelfProfile } from "@/types/api"

import { ChangePasswordDialog } from "./change-password-dialog"
import { EmailBindingDialog } from "./email-binding-dialog"
import { TwoFADialog, type TwoFAAction } from "./two-fa-dialog"

function SettingRow({
  icon: Icon,
  title,
  badge,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  badge?: React.ReactNode
  description: React.ReactNode
  action: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-row-alt text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span className="font-medium">{title}</span>
          {badge}
        </span>
        <span className="truncate text-sm text-muted-foreground">
          {description}
        </span>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  )
}

export function LoginAuthCard({
  user,
  loading,
}: {
  user: SelfProfile | undefined
  loading: boolean
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  // /security?bind=email (from the profile page) opens the email dialog.
  const [dialog, setDialog] = useState<"password" | "email" | null>(
    searchParams.get("bind") === "email" ? "email" : null
  )
  const [twoFAAction, setTwoFAAction] = useState<TwoFAAction | null>(null)
  const twoFA = useTwoFAStatus()
  const email = user?.email?.trim() || undefined
  // OAuth-only accounts set a first password through another flow.
  const noPassword = user?.has_password === false

  return (
    <Card>
      <CardHeader>
        <CardTitle>登录与认证</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col">
        {loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : (
          <>
            <SettingRow
              icon={KeyRoundIcon}
              title="更改密码"
              description={
                noPassword ? "账户尚未设置密码" : "更新您的密码以确保账户安全"
              }
              action={
                <Button
                  variant="outline"
                  disabled={noPassword}
                  onClick={() => setDialog("password")}
                >
                  更改密码
                </Button>
              }
            />
            <TwoFARow status={twoFA} onAction={setTwoFAAction} />
            <Separator className="my-2" />
            <h3 className="pt-2 text-sm font-medium text-muted-foreground">
              账户绑定
            </h3>
            <SettingRow
              icon={MailIcon}
              title="邮箱"
              badge={
                email && (
                  <Badge variant="success" className="h-5 shrink-0 px-2">
                    已绑定
                  </Badge>
                )
              }
              description={
                email ? <span className="break-all">{email}</span> : "未绑定"
              }
              action={
                <Button variant="outline" onClick={() => setDialog("email")}>
                  {email ? "更换" : "绑定"}
                </Button>
              }
            />
          </>
        )}
      </CardContent>

      <ChangePasswordDialog
        open={dialog === "password"}
        onOpenChange={(open) => setDialog(open ? "password" : null)}
      />
      <TwoFADialog
        action={twoFAAction}
        onOpenChange={(open) => !open && setTwoFAAction(null)}
      />
      <EmailBindingDialog
        open={dialog === "email"}
        onOpenChange={(open) => {
          setDialog(open ? "email" : null)
          if (!open && searchParams.has("bind"))
            setSearchParams(
              (params) => {
                params.delete("bind")
                return params
              },
              { replace: true }
            )
        }}
        currentEmail={email}
      />
    </Card>
  )
}

function TwoFARow({
  status,
  onAction,
}: {
  status: ReturnType<typeof useTwoFAStatus>
  onAction: (action: TwoFAAction) => void
}) {
  const data = status.data
  let description: React.ReactNode
  let action: React.ReactNode
  if (status.isPending) {
    description = "正在读取状态…"
    action = <Skeleton className="h-9 w-20" />
  } else if (status.isError || !data) {
    description = "无法读取两步验证状态"
    action = (
      <Button variant="outline" onClick={() => void status.refetch()}>
        重试
      </Button>
    )
  } else if (data.enabled) {
    const remaining = data.backup_codes_remaining
    description = data.locked
      ? "验证失败次数过多，暂时锁定"
      : remaining === undefined
        ? "登录时需输入身份验证器中的验证码"
        : `剩余 ${remaining} 个备用码`
    action = (
      <div className="flex items-center gap-2">
        <Badge variant={data.locked ? "warning" : "success"}>
          {data.locked ? "已锁定" : "已启用"}
        </Badge>
        <Button variant="outline" onClick={() => onAction("backup")}>
          备用码
        </Button>
        <Button variant="outline" onClick={() => onAction("disable")}>
          关闭
        </Button>
      </div>
    )
  } else {
    description = "使用身份验证器 App 为登录增加一层保护"
    action = (
      <Button variant="outline" onClick={() => onAction("enable")}>
        启用
      </Button>
    )
  }
  return (
    <SettingRow
      icon={ShieldCheckIcon}
      title="两步验证（2FA）"
      description={description}
      action={action}
    />
  )
}
