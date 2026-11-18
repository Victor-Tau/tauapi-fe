import { useEffect, useState, type FormEvent } from "react"
import { Link, useNavigate, useSearchParams } from "react-router"
import { toast } from "sonner"

import { registerAccount, sendRegisterCode } from "@/api/account"
import { ApiError, errorMessage } from "@/api/errors"
import {
  AUTH_BUTTON,
  AUTH_INPUT,
  AUTH_HIT,
  AUTH_INPUT_GROUP,
  AUTH_LABEL,
  AUTH_LINK,
  AuthShell,
} from "@/components/auth-shell"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
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
import { useSiteStatus } from "@/hooks/use-queries"
import { PASSWORD_RULES, passwordMeetsPolicy } from "@/lib/password-policy"
import { cn } from "@/lib/utils"
import { CodeInput } from "./code-input"
import { PasswordInput } from "./password-input"
import { RuleIcon } from "./rule-icon"

const RESEND_SECONDS = 60
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/

/** Form order: the first invalid one takes focus. */
const FIELDS = {
  username: "reg-username",
  email: "reg-email",
  code: "reg-code",
  password: "reg-password",
  confirm: "reg-confirm",
} as const
type FieldKey = keyof typeof FIELDS
type FieldErrors = Partial<Record<FieldKey, string>>

/** A short horizontal shake on each field that needs attention. */
function shakeFields(keys: FieldKey[]) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
  for (const key of keys) {
    document
      .getElementById(FIELDS[key])
      ?.closest<HTMLElement>("[data-slot=field]")
      ?.animate(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-6px)" },
          { transform: "translateX(5px)" },
          { transform: "translateX(-3px)" },
          { transform: "translateX(2px)" },
          { transform: "translateX(0)" },
        ],
        { duration: 400, easing: "ease-out" }
      )
  }
}

export default function RegisterPage() {
  const site = useSiteStatus()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [typing, setTyping] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [pending, setPending] = useState(false)
  const [sending, setSending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  // Bubble over the code boxes after the server rejects the code.
  const [codeRejected, setCodeRejected] = useState(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const id = window.setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => window.clearTimeout(id)
  }, [cooldown])

  const status = site.data
  // Registration is email-only: the address and its code are always required.
  const disabled =
    status?.register_enabled === false
      ? "管理员已关闭新用户注册。"
      : status?.turnstile_check
        ? "服务器启用了人机验证，当前页面暂不支持，请联系管理员。"
        : ""

  const confirmMatches = confirm.length > 0 && confirm === password

  /** Marks the fields red, shakes them and focuses the first; false if none. */
  function flag(next: FieldErrors) {
    setErrors(next)
    const keys = (Object.keys(FIELDS) as FieldKey[]).filter((k) => next[k])
    if (keys.length === 0) return false
    document.getElementById(FIELDS[keys[0]])?.focus()
    shakeFields(keys)
    return true
  }

  function edit(key: FieldKey, set: (value: string) => void) {
    return (event: { target: { value: string } }) => {
      set(event.target.value)
      if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
    }
  }

  function emailError() {
    const value = email.trim()
    if (!value) return "请输入邮箱"
    if (!EMAIL_PATTERN.test(value)) return "邮箱格式不正确"
    return undefined
  }

  function fieldError(key: FieldKey): string | undefined {
    switch (key) {
      case "username": {
        const name = username.trim()
        if (!name) return "请输入用户名"
        return [...name].length > 20 ? "用户名最多 20 个字符" : undefined
      }
      case "email":
        return emailError()
      case "code":
        // Empty boxes are kept as spaces inside the value.
        if (!code.trim()) return "请输入验证码"
        return code.length < 6 || code.includes(" ")
          ? "验证码为 6 位"
          : undefined
      case "password":
        // An empty password says so; otherwise the rule list turns red.
        if (!password) return "请输入密码"
        return passwordMeetsPolicy(password) ? undefined : "密码不符合要求"
      case "confirm":
        if (!confirm) return "请再次输入密码"
        return confirm !== password ? "两次输入的密码不一致" : undefined
    }
  }

  /** Validates fields once focus leaves; untouched empty fields stay quiet. */
  function check(...keys: FieldKey[]) {
    const next: FieldErrors = {}
    for (const key of keys) {
      const value = { username, email, code, password, confirm }[key]
      if (value) next[key] = fieldError(key)
    }
    setErrors((e) => ({ ...e, ...next }))
  }

  /** Puts a known server rejection on its field; false if it is not one. */
  function flagServerError(error: unknown) {
    // Match the server's English source text (`key`); `message` is the Chinese display text.
    const message = error instanceof ApiError ? (error.key ?? "") : ""
    const code = error instanceof ApiError ? error.code : undefined
    if (/verification code is incorrect/i.test(message)) {
      setCodeRejected(true)
      flag({ ...errors, code: "验证码错误或过期" })
      return true
    }
    let emailMessage: string | undefined
    if (/email policy|EMAIL_ADDRESS_REJECTED/i.test(message + code)) {
      emailMessage = /policy/i.test(message)
        ? "不支持这个邮箱，换一个试试"
        : "该邮箱地址不可用"
    } else if (/valid email/i.test(message)) {
      emailMessage = "邮箱格式不正确"
    } else if (/already in use|EMAIL_ALREADY_TAKEN/i.test(message + code)) {
      emailMessage = "该邮箱已被注册"
    }
    if (!emailMessage) return false
    flag({ ...errors, email: emailMessage })
    return true
  }

  async function sendCode() {
    if (sending || cooldown > 0) return
    if (flag({ ...errors, email: emailError() })) return
    setSending(true)
    try {
      await sendRegisterCode(email.trim())
      setCooldown(RESEND_SECONDS)
      toast.success("验证码已发送，请查收邮件")
    } catch (error) {
      if (flagServerError(error)) return
      const resendWait =
        error instanceof ApiError &&
        /wait .*before requesting another verification code/i.test(
          error.key ?? ""
        )
      toast.error(resendWait ? "别发了，休息一会儿吧" : errorMessage(error))
    } finally {
      setSending(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || disabled) return
    setSubmitted(true)
    const keys = Object.keys(FIELDS) as FieldKey[]
    const invalid = flag(
      Object.fromEntries(keys.map((key) => [key, fieldError(key)]))
    )
    if (invalid) return
    setPending(true)
    try {
      await registerAccount({
        username: username.trim(),
        password,
        email: email.trim(),
        // The backend issues lowercase hex and compares case-sensitively.
        verification_code: code.toLowerCase(),
        ...(params.get("aff") ? { aff_code: params.get("aff")! } : {}),
      })
      toast.success("注册成功，请登录")
      navigate("/login", { replace: true, viewTransition: true })
    } catch (error) {
      if (!flagServerError(error)) toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell
      title="创建账号"
      mascots={{
        isTyping: typing,
        isPasswordActive: passwordFocused,
      }}
      footer={
        <>
          已有账号？{" "}
          <Link to="/login" viewTransition className={AUTH_LINK}>
            登录
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <FieldGroup className="gap-7">
          <Field data-invalid={!!errors.username || undefined}>
            <FieldLabel className={AUTH_LABEL} htmlFor="reg-username">
              用户名
            </FieldLabel>
            <Input
              id="reg-username"
              className={AUTH_INPUT}
              autoComplete="username"
              placeholder="最多 20 个字符"
              maxLength={20}
              value={username}
              onChange={edit("username", setUsername)}
              onFocus={() => setTyping(true)}
              onBlur={() => {
                setTyping(false)
                check("username")
              }}
              disabled={pending}
              aria-invalid={!!errors.username || undefined}
              aria-describedby={
                errors.username ? "reg-username-error" : undefined
              }
            />
            {errors.username && (
              <FieldError id="reg-username-error" className="text-xs">
                {errors.username}
              </FieldError>
            )}
          </Field>
          <Field data-invalid={!!errors.email || undefined}>
            <FieldLabel className={AUTH_LABEL} htmlFor="reg-email">
              邮箱
            </FieldLabel>
            <InputGroup className={AUTH_INPUT_GROUP}>
              <InputGroupInput
                id="reg-email"
                className="px-0"
                type="email"
                autoComplete="email"
                placeholder="用于接收验证码"
                value={email}
                onChange={edit("email", setEmail)}
                onFocus={() => setTyping(true)}
                onBlur={() => {
                  setTyping(false)
                  check("email")
                }}
                disabled={pending}
                aria-invalid={!!errors.email || undefined}
                aria-describedby={errors.email ? "reg-email-error" : undefined}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="xs"
                  className={AUTH_HIT}
                  onClick={() => void sendCode()}
                  disabled={sending || cooldown > 0 || pending}
                >
                  {sending && <Spinner />}
                  {cooldown > 0 ? `${cooldown} 秒后重发` : "发送验证码"}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            {errors.email && (
              <FieldError id="reg-email-error" className="text-xs">
                {errors.email}
              </FieldError>
            )}
          </Field>
          <Field data-invalid={!!errors.code || undefined}>
            <FieldLabel className={AUTH_LABEL} htmlFor="reg-code">
              验证码
            </FieldLabel>
            <div className="relative mt-2">
              <CodeInput
                id="reg-code"
                autoComplete="one-time-code"
                value={code}
                onChange={(value) => {
                  setCode(value)
                  setCodeRejected(false)
                  if (errors.code) setErrors((e) => ({ ...e, code: undefined }))
                }}
                onBlur={() => check("code")}
                disabled={pending}
                aria-invalid={!!errors.code || undefined}
                aria-describedby={errors.code ? "reg-code-error" : undefined}
              />
              {codeRejected && errors.code && (
                <div
                  id="reg-code-error"
                  role="alert"
                  className="absolute top-full left-1/2 z-10 mt-2.5 -translate-x-1/2 animate-in rounded-lg bg-destructive px-3 py-1.5 text-xs font-medium whitespace-nowrap text-white shadow-md duration-200 fade-in zoom-in-95 slide-in-from-top-1"
                >
                  <span
                    aria-hidden="true"
                    className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rotate-45 bg-destructive"
                  />
                  {errors.code}
                </div>
              )}
            </div>
            {!codeRejected && errors.code && (
              <FieldError id="reg-code-error" className="text-xs">
                {errors.code}
              </FieldError>
            )}
          </Field>
          <Field data-invalid={!!errors.password || undefined}>
            <FieldLabel className={AUTH_LABEL} htmlFor="reg-password">
              密码
            </FieldLabel>
            <PasswordInput
              id="reg-password"
              // A changed password re-checks a confirmation already entered.
              onGroupBlur={() => check("password", "confirm")}
              autoComplete="new-password"
              placeholder="设置登录密码"
              value={password}
              onChange={edit("password", setPassword)}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              disabled={pending}
              aria-invalid={!!errors.password || undefined}
              aria-describedby="reg-password-rules"
            />
            <ul
              id="reg-password-rules"
              className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs"
            >
              {PASSWORD_RULES.map((rule) => {
                const met = rule.test(password)
                return (
                  <li
                    key={rule.label}
                    className={cn(
                      "flex items-center gap-1",
                      met
                        ? "text-success-text"
                        : submitted
                          ? "text-destructive"
                          : "text-muted-foreground"
                    )}
                  >
                    <RuleIcon met={met} />
                    <span className="sr-only">
                      {met ? "已满足：" : "未满足："}
                    </span>
                    {rule.label}
                  </li>
                )
              })}
            </ul>
          </Field>
          <Field data-invalid={!!errors.confirm || undefined}>
            <FieldLabel className={AUTH_LABEL} htmlFor="reg-confirm">
              确认密码
            </FieldLabel>
            <PasswordInput
              id="reg-confirm"
              onGroupBlur={() => check("confirm")}
              autoComplete="new-password"
              placeholder="再次输入密码"
              value={confirm}
              onChange={edit("confirm", setConfirm)}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              disabled={pending}
              aria-invalid={!!errors.confirm || undefined}
              aria-describedby="reg-confirm-rule"
            />
            <p
              id="reg-confirm-rule"
              className={cn(
                "flex items-center gap-1 text-xs transition-colors",
                confirmMatches
                  ? "text-success-text"
                  : errors.confirm
                    ? "text-destructive"
                    : "text-muted-foreground"
              )}
            >
              <RuleIcon met={confirmMatches} />
              <span className="sr-only">
                {confirmMatches ? "已满足：" : "未满足："}
              </span>
              输入一致的密码
            </p>
          </Field>
          <Field className="pt-2">
            <Button
              type="submit"
              size="lg"
              className={AUTH_BUTTON}
              disabled={pending || !!disabled}
            >
              {pending && <Spinner data-icon="inline-start" />}
              {pending ? "正在注册…" : "注册"}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </AuthShell>
  )
}
