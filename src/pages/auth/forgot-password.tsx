import { useState, type FormEvent } from "react"
import { ArrowLeftIcon, CircleAlertIcon, MailCheckIcon } from "lucide-react"
import { Link } from "react-router"

import { sendPasswordReset } from "@/api/account"
import { errorMessage } from "@/api/errors"
import {
  AUTH_BUTTON,
  AUTH_INPUT,
  AUTH_LABEL,
  AUTH_LINK,
  AuthShell,
} from "@/components/auth-shell"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { useSiteStatus } from "@/hooks/use-queries"

export default function ForgotPasswordPage() {
  const site = useSiteStatus()
  const [email, setEmail] = useState("")
  const [typing, setTyping] = useState(false)
  const [pending, setPending] = useState(false)
  const [sentTo, setSentTo] = useState("")
  const [formError, setFormError] = useState("")
  const turnstile = site.data?.turnstile_check === true

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || turnstile) return
    const value = email.trim()
    if (!/^\S+@\S+\.\S+$/.test(value)) {
      setFormError("请输入有效的邮箱地址。")
      return
    }
    setPending(true)
    setFormError("")
    try {
      await sendPasswordReset(value)
      setSentTo(value)
    } catch (error) {
      setFormError(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell
      title="忘记密码"
      description="输入账号绑定的邮箱，我们会发送重置链接"
      mascots={{ isTyping: typing }}
      footer={
        <>
          想起密码了？{" "}
          <Link to="/login" viewTransition className={AUTH_LINK}>
            返回登录
          </Link>
        </>
      }
    >
      {sentTo ? (
        <div className="flex flex-col gap-8">
          <Alert>
            <MailCheckIcon />
            <AlertTitle>请查收邮件</AlertTitle>
            <AlertDescription>
              如果 {sentTo}{" "}
              绑定了账号，重置链接已发送到该邮箱。链接有时效，请尽快打开。
            </AlertDescription>
          </Alert>
          <Button
            variant="secondary"
            size="lg"
            className={AUTH_BUTTON}
            render={<Link to="/login" viewTransition />}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            返回登录
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <FieldGroup className="gap-8">
            {turnstile && (
              <Alert>
                <CircleAlertIcon />
                <AlertTitle>暂不可用</AlertTitle>
                <AlertDescription>
                  服务器启用了人机验证，当前页面暂不支持，请联系管理员。
                </AlertDescription>
              </Alert>
            )}
            <Field>
              <FieldLabel className={AUTH_LABEL} htmlFor="forgot-email">
                邮箱
              </FieldLabel>
              <Input
                id="forgot-email"
                className={AUTH_INPUT}
                type="email"
                autoComplete="email"
                placeholder="输入你的邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setTyping(true)}
                onBlur={() => setTyping(false)}
                disabled={pending}
                autoFocus
              />
            </Field>
            {formError && (
              <Alert variant="destructive">
                <CircleAlertIcon />
                <AlertTitle>发送失败</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            <Field className="pt-2">
              <Button
                type="submit"
                size="lg"
                className={AUTH_BUTTON}
                disabled={pending || turnstile}
              >
                {pending && <Spinner data-icon="inline-start" />}
                {pending ? "正在发送…" : "发送重置链接"}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      )}
    </AuthShell>
  )
}
