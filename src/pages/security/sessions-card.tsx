import { useState } from "react"
import {
  LaptopIcon,
  LogOutIcon,
  MonitorSmartphoneIcon,
  SmartphoneIcon,
} from "lucide-react"
import { useNavigate } from "react-router"
import { useQueryClient, type UseQueryResult } from "@tanstack/react-query"
import { toast } from "sonner"

import { ApiError, errorMessage } from "@/api/errors"
import { revokeLoginSession } from "@/api/user"
import { ErrorAlert } from "@/components/error-alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/hooks/use-auth"
import { queryKeys } from "@/lib/query"
import type { LoginSession } from "@/types/api"
import { formatUnixSeconds } from "@/utils/format"

const LOGIN_METHODS: Record<string, string> = {
  password: "密码",
  passkey: "Passkey",
  github: "GitHub",
  discord: "Discord",
  oidc: "OIDC",
  linuxdo: "LinuxDO",
  telegram: "Telegram",
  wechat: "微信",
  email: "邮箱",
}

/** "Chrome · Windows" from a user agent; good enough to recognise a device. */
function describeAgent(agent: string | undefined): {
  name: string
  mobile: boolean
} {
  if (!agent) return { name: "未知设备", mobile: false }
  const browser = /Edg\//.test(agent)
    ? "Edge"
    : /OPR\/|Opera/.test(agent)
      ? "Opera"
      : /Firefox\//.test(agent)
        ? "Firefox"
        : /Chrome\//.test(agent)
          ? "Chrome"
          : /Safari\//.test(agent)
            ? "Safari"
            : null
  const os = /iPhone|iPad|iPod/.test(agent)
    ? "iOS"
    : /Android/.test(agent)
      ? "Android"
      : /Windows/.test(agent)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(agent)
          ? "macOS"
          : /Linux/.test(agent)
            ? "Linux"
            : null
  const mobile = /Mobile|iPhone|Android/.test(agent)
  const name = [browser, os].filter(Boolean).join(" · ")
  return { name: name || "未知设备", mobile }
}

function sortSessions(sessions: LoginSession[]) {
  return [...sessions].sort(
    (a, b) =>
      Number(b.current ?? false) - Number(a.current ?? false) ||
      (b.last_active_at ?? 0) - (a.last_active_at ?? 0)
  )
}

export function SessionsCard({
  sessions,
}: {
  sessions: UseQueryResult<LoginSession[]>
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [target, setTarget] = useState<LoginSession | null>(null)
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  function ask(session: LoginSession) {
    setTarget(session)
    setOpen(true)
  }

  async function confirm() {
    if (!target || pending) return
    setPending(true)
    try {
      if (target.current) {
        // This browser: the regular logout also clears the refresh cookie.
        try {
          await logout()
        } finally {
          void navigate("/login", { replace: true })
        }
        return
      }
      try {
        await revokeLoginSession(target.sid)
        toast.success("已退出该设备的登录")
      } catch (error) {
        // Already gone (expired or revoked elsewhere): same end state.
        if (!(
          error instanceof ApiError && error.code === "AUTH_SESSION_NOT_FOUND"
        )) {
          throw error
        }
      }
      setOpen(false)
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions })
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  const targetName = target ? describeAgent(target.user_agent).name : ""

  return (
    <Card>
      <CardHeader>
        <CardTitle>登录设备</CardTitle>
        <CardDescription>当前已登录本账户的浏览器会话。</CardDescription>
      </CardHeader>
      <CardContent>
        {sessions.isPending ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 2 }, (_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : sessions.isError ? (
          <ErrorAlert
            error={sessions.error}
            onRetry={() => void sessions.refetch()}
            retrying={sessions.isFetching}
          />
        ) : sessions.data.length ? (
          <ul className="flex flex-col">
            {sortSessions(sessions.data).map((session, index) => {
              const device = describeAgent(session.user_agent)
              const Icon = device.mobile ? SmartphoneIcon : LaptopIcon
              const method = session.login_method
                ? (LOGIN_METHODS[session.login_method] ?? session.login_method)
                : null
              return (
                <li key={session.sid}>
                  {index > 0 && <Separator />}
                  <div className="flex items-center gap-3 py-3">
                    <span className="flex size-9 shrink-0 items-center justify-center self-start rounded-lg bg-row-alt text-muted-foreground">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2 font-medium">
                        <span className="truncate" title={session.user_agent}>
                          {device.name}
                        </span>
                        {session.current && (
                          <Badge variant="success" className="h-5 px-2">
                            当前设备
                          </Badge>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {[
                          session.ip || null,
                          method ? `${method}登录` : null,
                          `登录于 ${formatUnixSeconds(session.created_at)}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        最近活动 {formatUnixSeconds(session.last_active_at)}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      className="shrink-0"
                      onClick={() => ask(session)}
                    >
                      <LogOutIcon data-icon="inline-start" />
                      退出登录
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MonitorSmartphoneIcon />
              </EmptyMedia>
              <EmptyTitle>没有登录会话</EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {target?.current ? "退出当前设备的登录？" : "退出该设备的登录？"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {target?.current
                ? "退出后将返回登录页，需要重新输入账号密码。"
                : `${targetName}${target?.ip ? `（${target.ip}）` : ""} 将立即退出，需要重新登录才能继续使用。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={() => void confirm()}
            >
              {pending && <Spinner data-icon="inline-start" />}
              {pending ? "正在退出…" : "退出登录"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
