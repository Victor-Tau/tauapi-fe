import { useState } from "react"
import { CircleAlertIcon, CopyIcon, KeyRoundIcon } from "lucide-react"
import { Link, useSearchParams } from "react-router"
import { toast } from "sonner"

import { confirmPasswordReset } from "@/api/account"
import { errorMessage } from "@/api/errors"
import { AUTH_BUTTON, AUTH_LINK, AuthShell } from "@/components/auth-shell"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { copyText } from "@/utils/clipboard"

/**
 * Target of the mailed link (`/user/reset?email=…&token=…`). The server
 * replaces the password with a random one and returns it once.
 */
export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const email = params.get("email")?.trim() ?? ""
  const token = params.get("token")?.trim() ?? ""
  const [pending, setPending] = useState(false)
  const [password, setPassword] = useState("")
  const [formError, setFormError] = useState(
    email && token ? "" : "重置链接不完整，请重新申请。"
  )

  async function confirm() {
    if (pending) return
    setPending(true)
    setFormError("")
    try {
      setPassword(await confirmPasswordReset(email, token))
    } catch (error) {
      setFormError(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  async function copy() {
    if (await copyText(password)) toast.success("已复制")
    else toast.error("复制失败，请手动选择密码复制")
  }

  return (
    <AuthShell
      title="重置密码"
      description={email || "通过邮件链接重置账号密码"}
      mascots={{ isPasswordActive: !!password }}
      footer={
        <>
          链接失效了？{" "}
          <Link to="/forgot-password" viewTransition className={AUTH_LINK}>
            重新申请
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-8">
        {password ? (
          <>
            <Alert>
              <KeyRoundIcon />
              <AlertTitle>密码已重置</AlertTitle>
              <AlertDescription>
                这是系统生成的新密码，只显示这一次。请用它登录后，在「安全设置」中修改。
              </AlertDescription>
            </Alert>
            <div className="flex items-center justify-between gap-3 border-b border-foreground/25 pb-2">
              <code className="font-mono text-lg tracking-wide select-all">
                {password}
              </code>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="复制新密码"
                onClick={() => void copy()}
              >
                <CopyIcon />
              </Button>
            </div>
            <Button
              size="lg"
              className={AUTH_BUTTON}
              render={<Link to="/login" replace viewTransition />}
            >
              前往登录
            </Button>
          </>
        ) : (
          <>
            {formError ? (
              <Alert variant="destructive">
                <CircleAlertIcon />
                <AlertTitle>无法重置</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                确认后，系统会为该账号生成一个新的随机密码，旧密码立即失效。
              </p>
            )}
            <Button
              size="lg"
              className={AUTH_BUTTON}
              disabled={pending || !email || !token}
              onClick={() => void confirm()}
            >
              {pending && <Spinner data-icon="inline-start" />}
              {pending ? "正在重置…" : "确认重置密码"}
            </Button>
          </>
        )}
      </div>
    </AuthShell>
  )
}
