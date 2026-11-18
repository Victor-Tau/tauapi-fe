import { useEffect, useState, type FormEvent } from "react"
import { CircleAlertIcon } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  finishEmailBinding,
  normalizeEmail,
  requestProof,
  resendEmailBinding,
  securityErrorMessage,
  startEmailBinding,
  type EmailBinding,
} from "@/api/security"
import { ErrorAlert } from "@/components/error-alert"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { queryKeys } from "@/lib/query"

import { useVerificationMode } from "./use-verification-mode"

/** The server's own limits: a plain address of at most 50 characters. */
function emailProblem(email: string): string | null {
  const value = normalizeEmail(email)
  if (!value) return "请输入邮箱地址"
  if (value.length > 50) return "邮箱地址不能超过 50 个字符"
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "邮箱地址格式不正确"
  return null
}

export function EmailBindingDialog({
  open,
  onOpenChange,
  currentEmail,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentEmail: string | undefined
}) {
  const replacing = Boolean(currentEmail)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{replacing ? "更换邮箱" : "绑定邮箱"}</DialogTitle>
          <DialogDescription>
            {replacing
              ? `当前绑定：${currentEmail}。新邮箱验证通过后替换。`
              : "绑定后可用于接收账户安全通知。"}
          </DialogDescription>
        </DialogHeader>
        {/* The popup unmounts once closed, so each opening starts afresh. */}
        <EmailBindingFlow
          currentEmail={currentEmail}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <Alert variant="destructive">
      <CircleAlertIcon />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

function EmailBindingFlow({
  currentEmail,
  onDone,
}: {
  currentEmail: string | undefined
  onDone: () => void
}) {
  const [binding, setBinding] = useState<EmailBinding | null>(null)
  return binding ? (
    <CodeStep
      binding={binding}
      currentEmail={currentEmail}
      onResent={setBinding}
      onDone={onDone}
    />
  ) : (
    <AddressStep onStarted={setBinding} />
  )
}

function AddressStep({
  onStarted,
}: {
  onStarted: (binding: EmailBinding) => void
}) {
  const mode = useVerificationMode("account.binding.bind", true)
  const [email, setEmail] = useState("")
  const [secret, setSecret] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const method = mode.kind === "ready" ? mode.method : null
  const errors = {
    email: emailProblem(email),
    secret: secret.trim()
      ? null
      : method === "2fa"
        ? "请输入两步验证码"
        : "请输入当前密码",
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (errors.email || errors.secret || pending || !method) return
    setPending(true)
    setError(null)
    try {
      const address = normalizeEmail(email)
      // The proof is bound to this exact address.
      const proof = await requestProof({
        scope: "account.binding.bind",
        method,
        context: { provider: "email", email: address },
        password: method === "password" ? secret : undefined,
        code: method === "2fa" ? secret : undefined,
      })
      onStarted(await startEmailBinding(address, proof))
    } catch (caught) {
      setError(securityErrorMessage(caught))
    } finally {
      setPending(false)
    }
  }

  if (mode.kind === "loading") {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }
  if (mode.kind === "error") {
    return (
      <ErrorAlert
        title="无法读取验证方式"
        error={mode.error}
        onRetry={mode.retry}
      />
    )
  }
  if (mode.kind === "unsupported") {
    return <ErrorLine message={mode.reason} />
  }

  const show = (message: string | null) =>
    submitted && message ? <FieldError>{message}</FieldError> : null

  return (
    <form onSubmit={(event) => void submit(event)} noValidate>
      <FieldGroup className="gap-4">
        <Field data-invalid={(submitted && !!errors.email) || undefined}>
          <FieldLabel htmlFor="bind-email">邮箱地址</FieldLabel>
          <Input
            id="bind-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="name@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoFocus
          />
          {show(errors.email)}
        </Field>
        <Field data-invalid={(submitted && !!errors.secret) || undefined}>
          {method === "2fa" ? (
            <>
              <FieldLabel htmlFor="bind-secret">两步验证码</FieldLabel>
              <Input
                id="bind-secret"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="身份验证器中的 6 位数字或备用码"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
              />
            </>
          ) : (
            <>
              <FieldLabel htmlFor="bind-secret">当前密码</FieldLabel>
              <Input
                id="bind-secret"
                type="password"
                autoComplete="current-password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
              />
            </>
          )}
          <FieldDescription>用于确认是您本人在操作。</FieldDescription>
          {show(errors.secret)}
        </Field>
        <ErrorLine message={error} />
      </FieldGroup>
      <DialogFooter className="mt-6">
        <DialogClose render={<Button type="button" variant="outline" />}>
          取消
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          {pending ? "正在发送…" : "发送验证码"}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Seconds left until `at` (Unix seconds), ticking once a second. */
function useSecondsUntil(at: number | undefined): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    if (!at) return
    const id = window.setInterval(() => {
      const current = Math.floor(Date.now() / 1000)
      setNow(current)
      if (current >= at) window.clearInterval(id)
    }, 1000)
    return () => window.clearInterval(id)
  }, [at])
  return at ? Math.max(0, at - now) : 0
}

function CodeStep({
  binding,
  currentEmail,
  onResent,
  onDone,
}: {
  binding: EmailBinding
  currentEmail: string | undefined
  onResent: (binding: EmailBinding) => void
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const [newCode, setNewCode] = useState("")
  const [oldCode, setOldCode] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const wait = useSecondsUntil(binding.resend_at)
  const needsOld = binding.old_email_required === true
  const oldAddress = binding.current_email || currentEmail

  const errors = {
    newCode: newCode.trim() ? null : "请输入新邮箱收到的验证码",
    oldCode: needsOld && !oldCode.trim() ? "请输入原邮箱收到的验证码" : null,
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (errors.newCode || errors.oldCode || pending) return
    setPending(true)
    setError(null)
    try {
      await finishEmailBinding({
        flowToken: binding.flow_token,
        newCode,
        oldCode: needsOld ? oldCode : undefined,
      })
      void queryClient.invalidateQueries({ queryKey: queryKeys.self })
      toast.success(`邮箱已绑定为 ${binding.email}`)
      onDone()
    } catch (caught) {
      setError(securityErrorMessage(caught))
    } finally {
      setPending(false)
    }
  }

  async function resend() {
    if (resending || wait > 0) return
    setResending(true)
    setError(null)
    try {
      onResent(await resendEmailBinding(binding.flow_token))
      toast.success("验证码已重新发送")
    } catch (caught) {
      setError(securityErrorMessage(caught))
    } finally {
      setResending(false)
    }
  }

  const show = (message: string | null) =>
    submitted && message ? <FieldError>{message}</FieldError> : null

  return (
    <form onSubmit={(event) => void submit(event)} noValidate>
      <FieldGroup className="gap-4">
        <p className="text-sm text-muted-foreground">
          验证码已发送至{" "}
          <span className="font-medium break-all text-foreground">
            {binding.email}
          </span>
          {needsOld && oldAddress && (
            <>
              {" "}
              和原邮箱{" "}
              <span className="font-medium break-all text-foreground">
                {oldAddress}
              </span>
            </>
          )}
          ，10 分钟内有效。
        </p>
        <Field data-invalid={(submitted && !!errors.newCode) || undefined}>
          <FieldLabel htmlFor="bind-new-code">新邮箱验证码</FieldLabel>
          <Input
            id="bind-new-code"
            autoComplete="one-time-code"
            value={newCode}
            onChange={(event) => setNewCode(event.target.value)}
            autoFocus
          />
          {show(errors.newCode)}
        </Field>
        {needsOld && (
          <Field data-invalid={(submitted && !!errors.oldCode) || undefined}>
            <FieldLabel htmlFor="bind-old-code">原邮箱验证码</FieldLabel>
            <Input
              id="bind-old-code"
              autoComplete="one-time-code"
              value={oldCode}
              onChange={(event) => setOldCode(event.target.value)}
            />
            {show(errors.oldCode)}
          </Field>
        )}
        <ErrorLine message={error} />
      </FieldGroup>
      <DialogFooter className="mt-6 sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          disabled={wait > 0 || resending}
          onClick={() => void resend()}
        >
          {resending
            ? "正在发送…"
            : wait > 0
              ? `${wait} 秒后可重新发送`
              : "重新发送验证码"}
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          {pending ? "正在验证…" : "完成绑定"}
        </Button>
      </DialogFooter>
    </form>
  )
}
