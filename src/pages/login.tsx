import { useState, type FormEvent } from "react"
import { Link } from "react-router"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CircleAlertIcon,
  EyeIcon,
  EyeOffIcon,
  RotateCwIcon,
} from "lucide-react"

import { ApiError, errorMessage } from "@/api/errors"
import { securityErrorMessage } from "@/api/security"
import {
  AUTH_BUTTON,
  AUTH_HIT,
  AUTH_INPUT,
  AUTH_INPUT_GROUP,
  AUTH_LABEL,
  AUTH_LINK,
  AuthShell,
} from "@/components/auth-shell"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/hooks/use-auth"

export default function LoginPage() {
  const auth = useAuth()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [typing, setTyping] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [pending, setPending] = useState(false)
  const [formError, setFormError] = useState("")
  // Set when the server asks for an authenticator code after the password.
  const [challenge, setChallenge] = useState<string | null>(null)
  const [code, setCode] = useState("")

  const restoring = auth.status === "loading"
  const restoreFailed = auth.status === "error"
  const shownError =
    formError || (restoreFailed && auth.error ? errorMessage(auth.error) : "")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    if (!username.trim() || !password) {
      setFormError("请输入用户名或邮箱，以及密码。")
      return
    }
    setPending(true)
    setFormError("")
    try {
      // On success the guest guard redirects to the validated `next` path.
      const result = await auth.login({ username: username.trim(), password })
      if (result.kind === "challenge") {
        setChallenge(result.flowToken)
        setCode("")
      }
    } catch (error) {
      setFormError(errorMessage(error))
    } finally {
      setPassword("")
      setPending(false)
    }
  }

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || !challenge) return
    if (!code.trim()) {
      setFormError("请输入验证码。")
      return
    }
    setPending(true)
    setFormError("")
    try {
      await auth.verifyLogin(challenge, code)
    } catch (error) {
      setFormError(securityErrorMessage(error))
      // An expired or consumed flow can only be restarted with the password.
      if (error instanceof ApiError && error.code === "AUTH_FLOW_INVALID") {
        setChallenge(null)
      }
    } finally {
      setCode("")
      setPending(false)
    }
  }

  function backToPassword() {
    setChallenge(null)
    setCode("")
    setFormError("")
  }

  async function retryRestore() {
    setFormError("")
    try {
      await auth.restore()
    } catch (error) {
      setFormError(errorMessage(error))
    }
  }

  return (
    <AuthShell
      title="欢迎回来！"
      mascots={{
        isTyping: typing,
        isPasswordActive: passwordFocused || password.length > 0,
      }}
      footer={
        <>
          还没有账号？{" "}
          <Link to="/register" viewTransition className={AUTH_LINK}>
            注册
          </Link>
        </>
      }
    >
      {challenge ? (
        <form onSubmit={submitCode} noValidate>
          <FieldGroup className="gap-8">
            <Field>
              <FieldLabel className={AUTH_LABEL} htmlFor="login-2fa">
                两步验证码
              </FieldLabel>
              <Input
                id="login-2fa"
                className={AUTH_INPUT}
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="身份验证器中的 6 位数字或备用码"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                disabled={pending}
                autoFocus
              />
              <FieldDescription>
                该账户已启用两步验证，请输入身份验证器 App 中的验证码。
              </FieldDescription>
            </Field>
            {formError && (
              <Alert variant="destructive">
                <CircleAlertIcon />
                <AlertTitle>验证失败</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            <Field className="gap-3 pt-2">
              <Button
                type="submit"
                size="lg"
                className={AUTH_BUTTON}
                disabled={pending}
              >
                {pending && <Spinner data-icon="inline-start" />}
                {pending ? "正在验证…" : "验证并登录"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className={AUTH_BUTTON}
                disabled={pending}
                onClick={backToPassword}
              >
                <ArrowLeftIcon data-icon="inline-start" />
                返回密码登录
              </Button>
            </Field>
          </FieldGroup>
        </form>
      ) : (
        <form onSubmit={submit} noValidate>
          <FieldGroup className="gap-8">
            <Field>
              <FieldLabel className={AUTH_LABEL} htmlFor="username">
                用户名
              </FieldLabel>
              <Input
                id="username"
                className={AUTH_INPUT}
                name="username"
                autoComplete="username"
                placeholder="输入用户名或邮箱"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                onFocus={() => setTyping(true)}
                onBlur={() => setTyping(false)}
                disabled={pending}
                required
              />
            </Field>
            <Field>
              <FieldLabel className={AUTH_LABEL} htmlFor="password">
                密码
              </FieldLabel>
              <InputGroup className={AUTH_INPUT_GROUP}>
                <InputGroupInput
                  className="px-0"
                  id="password"
                  name="password"
                  type={passwordVisible ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="输入你的密码"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  disabled={pending}
                  required
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    className={AUTH_HIT}
                    aria-label={passwordVisible ? "隐藏密码" : "显示密码"}
                    onClick={() => setPasswordVisible((value) => !value)}
                  >
                    {passwordVisible ? <EyeOffIcon /> : <EyeIcon />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <div className="flex justify-end">
                <Link
                  to="/forgot-password"
                  viewTransition
                  className="relative text-xs text-muted-foreground underline-offset-4 after:absolute after:-inset-x-1 after:-inset-y-2 hover:text-foreground hover:underline"
                >
                  忘记密码？
                </Link>
              </div>
            </Field>
            {shownError && (
              <Alert variant="destructive">
                <CircleAlertIcon />
                <AlertTitle>
                  {restoreFailed && !formError ? "连接失败" : "无法登录"}
                </AlertTitle>
                <AlertDescription className="flex flex-col items-start gap-2">
                  <span>{shownError}</span>
                  {restoreFailed && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void retryRestore()}
                    >
                      <RotateCwIcon data-icon="inline-start" />
                      重试
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            )}
            <Field className="pt-2">
              <Button
                type="submit"
                size="lg"
                className={AUTH_BUTTON}
                disabled={pending || restoring}
              >
                {pending || restoring ? (
                  <Spinner data-icon="inline-start" />
                ) : null}
                {pending
                  ? "正在登录…"
                  : restoring
                    ? "正在恢复会话…"
                    : "登录控制台"}
                {!pending && !restoring && (
                  <ArrowRightIcon data-icon="inline-end" />
                )}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      )}
    </AuthShell>
  )
}
