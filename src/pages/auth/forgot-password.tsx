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
import { AuthTurnstile } from "@/components/auth-turnstile"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { useAuthTurnstile } from "@/hooks/use-auth-turnstile"

export default function ForgotPasswordPage() {
  const turnstile = useAuthTurnstile()
  const [email, setEmail] = useState("")
  const [typing, setTyping] = useState(false)
  const [pending, setPending] = useState(false)
  const [sentTo, setSentTo] = useState("")
  const [formError, setFormError] = useState("")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || !turnstile.ready) return
    const value = email.trim()
    if (!/^\S+@\S+\.\S+$/.test(value)) {
      setFormError("请输入有效的邮箱地址。")
      return
    }
    setPending(true)
    setFormError("")
    try {
      await turnstile.withToken((token) => sendPasswordReset(value, token))
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
            <AuthTurnstile check={turnstile} />
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
                disabled={pending || !turnstile.ready}
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
