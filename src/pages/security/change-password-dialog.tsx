import { useState, type FormEvent } from "react"
import { CheckIcon, CircleAlertIcon, XIcon } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  changePassword,
  requestProof,
  securityErrorMessage,
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { queryKeys } from "@/lib/query"
import { PASSWORD_RULES, passwordMeetsPolicy } from "@/lib/password-policy"
import { cn } from "@/lib/utils"

import { useVerificationMode } from "./use-verification-mode"

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>更改密码</DialogTitle>
          <DialogDescription>
            更新后，其他设备上的登录将全部失效，当前设备保持登录。
          </DialogDescription>
        </DialogHeader>
        {/* The popup unmounts once closed, taking the passwords with it. */}
        <ChangePasswordForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient()
  const mode = useVerificationMode("account.password.change", true)
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [code, setCode] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const needsCode = mode.kind === "ready" && mode.method === "2fa"
  const errors = {
    current: current ? null : "请输入当前登录密码",
    next: !passwordMeetsPolicy(next)
      ? "新密码不符合要求"
      : next === current
        ? "新密码不能与当前登录密码相同"
        : null,
    confirm: confirm === next ? null : "两次输入的新密码不一致",
    code: needsCode && !code.trim() ? "请输入两步验证码" : null,
  }
  const valid = Object.values(errors).every((message) => message === null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (!valid || pending || mode.kind !== "ready") return
    setPending(true)
    setError(null)
    try {
      const proof = await requestProof({
        scope: "account.password.change",
        method: mode.method,
        password: mode.method === "password" ? current : undefined,
        code: mode.method === "2fa" ? code : undefined,
      })
      const result = await changePassword({ current, next, proof })
      void queryClient.invalidateQueries({ queryKey: queryKeys.self })
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions })
      toast.success("密码已更新，其他设备已退出登录")
      if (result.notificationWarning) {
        toast.warning("安全通知邮件发送失败，不影响本次修改。")
      }
      onDone()
    } catch (caught) {
      setError(securityErrorMessage(caught))
    } finally {
      setPending(false)
    }
  }

  if (mode.kind === "loading") {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
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
    return (
      <Alert>
        <CircleAlertIcon />
        <AlertDescription>{mode.reason}</AlertDescription>
      </Alert>
    )
  }

  const show = (message: string | null) =>
    submitted && message ? <FieldError>{message}</FieldError> : null

  return (
    <form onSubmit={(event) => void submit(event)} noValidate>
      <FieldGroup className="gap-4">
        <Field data-invalid={(submitted && !!errors.current) || undefined}>
          <FieldLabel htmlFor="password-current">当前登录密码</FieldLabel>
          <Input
            id="password-current"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            autoFocus
          />
          {show(errors.current)}
        </Field>
        <Field data-invalid={(submitted && !!errors.next) || undefined}>
          <FieldLabel htmlFor="password-next">新密码</FieldLabel>
          <Input
            id="password-next"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
            aria-describedby="password-rules"
          />
          <ul
            id="password-rules"
            className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs"
          >
            {PASSWORD_RULES.map((rule) => {
              const met = rule.test(next)
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
                  {met ? (
                    <CheckIcon className="size-3.5" aria-hidden="true" />
                  ) : (
                    <XIcon className="size-3.5" aria-hidden="true" />
                  )}
                  <span className="sr-only">
                    {met ? "已满足：" : "未满足："}
                  </span>
                  {rule.label}
                </li>
              )
            })}
          </ul>
          {submitted &&
            errors.next === "新密码不能与当前登录密码相同" &&
            show(errors.next)}
        </Field>
        <Field data-invalid={(submitted && !!errors.confirm) || undefined}>
          <FieldLabel htmlFor="password-confirm">确认新密码</FieldLabel>
          <Input
            id="password-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
          {show(errors.confirm)}
        </Field>
        {needsCode && (
          <Field data-invalid={(submitted && !!errors.code) || undefined}>
            <FieldLabel htmlFor="password-2fa">两步验证码</FieldLabel>
            <Input
              id="password-2fa"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="身份验证器中的 6 位数字或备用码"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
            {show(errors.code)}
          </Field>
        )}
        {error && (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </FieldGroup>
      <DialogFooter className="mt-6">
        <DialogClose render={<Button type="button" variant="outline" />}>
          取消
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          {pending ? "正在更新…" : "更新密码"}
        </Button>
      </DialogFooter>
    </form>
  )
}
