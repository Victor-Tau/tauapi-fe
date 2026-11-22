import { useState, type FormEvent } from "react"
import { CircleAlertIcon } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  disableTwoFA,
  enableTwoFA,
  regenerateBackupCodes,
  requestProof,
  securityErrorMessage,
  startTwoFASetup,
  type TwoFASetup,
  type VerificationScope,
} from "@/api/security"
import { CopyButton } from "@/components/copy-button"
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

export type TwoFAAction = "enable" | "disable" | "backup"

const COPY: Record<
  TwoFAAction,
  { title: string; description: string; scope: VerificationScope }
> = {
  enable: {
    title: "启用两步验证",
    description:
      "启用后，登录和敏感操作需输入身份验证器 App 中的动态验证码，其他设备将退出登录。",
    scope: "2fa.setup",
  },
  disable: {
    title: "关闭两步验证",
    description: "关闭后登录只需密码，账户安全性会降低。",
    scope: "2fa.disable",
  },
  backup: {
    title: "重新生成备用码",
    description: "生成新的备用码后，旧的备用码将全部失效。",
    scope: "2fa.backup_codes.regenerate",
  },
}

export function TwoFADialog({
  action,
  onOpenChange,
}: {
  action: TwoFAAction | null
  onOpenChange: (open: boolean) => void
}) {
  // Keep the last action while the popup animates out.
  const [shown, setShown] = useState<TwoFAAction>("enable")
  if (action && action !== shown) setShown(action)
  const copy = COPY[shown]
  return (
    <Dialog open={action !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        {/* Unmounted once closed: secrets and codes leave memory with it. */}
        {action && (
          <TwoFAFlow
            key={action}
            action={action}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function TwoFAFlow({
  action,
  onDone,
}: {
  action: TwoFAAction
  onDone: () => void
}) {
  const [setup, setSetup] = useState<TwoFASetup | null>(null)
  const [codes, setCodes] = useState<string[] | null>(null)
  if (setup) return <EnrolStep setup={setup} onDone={onDone} />
  if (codes) {
    return (
      <div className="flex flex-col gap-4">
        <BackupCodes codes={codes} />
        <DialogFooter>
          <Button onClick={onDone}>我已保存</Button>
        </DialogFooter>
      </div>
    )
  }
  return (
    <VerifyStep
      action={action}
      onSetup={setSetup}
      onCodes={setCodes}
      onDone={onDone}
    />
  )
}

/** Step-up verification, then the action itself. */
function VerifyStep({
  action,
  onSetup,
  onCodes,
  onDone,
}: {
  action: TwoFAAction
  onSetup: (setup: TwoFASetup) => void
  onCodes: (codes: string[]) => void
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const { scope } = COPY[action]
  const mode = useVerificationMode(scope, true)
  const [secret, setSecret] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const method = mode.kind === "ready" ? mode.method : null
  const secretError = secret.trim()
    ? null
    : method === "2fa"
      ? "请输入两步验证码"
      : "请输入当前登录密码"

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (secretError || pending || !method) return
    setPending(true)
    setError(null)
    try {
      const proof = await requestProof({
        scope,
        method,
        password: method === "password" ? secret : undefined,
        code: method === "2fa" ? secret : undefined,
      })
      if (action === "enable") {
        onSetup(await startTwoFASetup(proof))
      } else if (action === "disable") {
        await disableTwoFA(proof)
        void queryClient.invalidateQueries({ queryKey: queryKeys.twoFA })
        void queryClient.invalidateQueries({ queryKey: queryKeys.sessions })
        toast.success("两步验证已关闭")
        onDone()
      } else {
        const codes = await regenerateBackupCodes(proof)
        void queryClient.invalidateQueries({ queryKey: queryKeys.twoFA })
        onCodes(codes)
      }
    } catch (caught) {
      setError(securityErrorMessage(caught))
    } finally {
      setSecret("")
      setPending(false)
    }
  }

  if (mode.kind === "loading") return <Skeleton className="h-24 w-full" />
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

  const isCode = method === "2fa"
  return (
    <form onSubmit={(event) => void submit(event)} noValidate>
      <FieldGroup className="gap-4">
        <Field data-invalid={(submitted && !!secretError) || undefined}>
          <FieldLabel htmlFor="twofa-verify">
            {isCode ? "两步验证码" : "登录密码"}
          </FieldLabel>
          <Input
            id="twofa-verify"
            type={isCode ? "text" : "password"}
            inputMode={isCode ? "numeric" : undefined}
            autoComplete={isCode ? "one-time-code" : "current-password"}
            placeholder={isCode ? "身份验证器中的 6 位数字或备用码" : undefined}
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            autoFocus
          />
          <FieldDescription>先验证身份，再继续操作。</FieldDescription>
          {submitted && secretError && <FieldError>{secretError}</FieldError>}
        </Field>
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
        <Button
          type="submit"
          variant={action === "disable" ? "destructive" : "default"}
          disabled={pending}
        >
          {pending && <Spinner data-icon="inline-start" />}
          {pending
            ? "正在验证…"
            : action === "disable"
              ? "关闭两步验证"
              : "继续"}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** QR code, manual secret and backup codes; confirmed with a first code. */
function EnrolStep({
  setup,
  onDone,
}: {
  setup: TwoFASetup
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const [code, setCode] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const codeError = /^\d{6}$/.test(code.trim()) ? null : "请输入 6 位数字验证码"

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (codeError || pending) return
    setPending(true)
    setError(null)
    try {
      await enableTwoFA(setup.flow_token, code)
      void queryClient.invalidateQueries({ queryKey: queryKeys.twoFA })
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions })
      toast.success("两步验证已启用，其他设备已退出登录")
      onDone()
    } catch (caught) {
      setError(securityErrorMessage(caught))
      setCode("")
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate>
      <FieldGroup className="gap-5">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          <div className="shrink-0 rounded-xl bg-white p-3 ring-1 ring-divider">
            <QRCodeSVG value={setup.qr_code_data} size={148} />
          </div>
          <div className="flex min-w-0 flex-col gap-2 text-sm">
            <p className="font-medium">1. 扫描二维码</p>
            <p className="text-muted-foreground">
              使用 Google Authenticator、Microsoft Authenticator 等身份验证器
              App 扫描，或手动输入密钥：
            </p>
            <div className="flex items-center gap-1">
              <code className="min-w-0 rounded-md bg-row-alt px-2 py-1 font-mono text-xs break-all">
                {setup.secret}
              </code>
              <CopyButton
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="复制密钥"
                text={setup.secret}
                what="密钥"
                failMessage="复制失败，请手动选择"
              />
            </div>
          </div>
        </div>
        {setup.backup_codes.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">2. 保存备用码</p>
            <BackupCodes codes={setup.backup_codes} />
          </div>
        )}
        <Field data-invalid={(submitted && !!codeError) || undefined}>
          <FieldLabel htmlFor="twofa-enrol">
            {setup.backup_codes.length > 0 ? "3" : "2"}. 输入 App 中的验证码
          </FieldLabel>
          <Input
            id="twofa-enrol"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="6 位数字"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          {submitted && codeError && <FieldError>{codeError}</FieldError>}
        </Field>
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
          {pending ? "正在启用…" : "确认启用"}
        </Button>
      </DialogFooter>
    </form>
  )
}

function BackupCodes({ codes }: { codes: string[] }) {
  return (
    <div className="flex flex-col gap-2">
      <ul className="grid grid-cols-2 gap-1.5 rounded-xl bg-row-alt p-3 font-mono text-sm tabular-nums">
        {codes.map((code) => (
          <li key={code} className="text-center">
            {code}
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          每个备用码只能使用一次，仅显示这一次，请妥善保存。
        </p>
        <CopyButton
          type="button"
          variant="outline"
          size="sm"
          text={codes.join("\n")}
          what="备用码"
          failMessage="复制失败，请手动记录"
        >
          复制
        </CopyButton>
      </div>
    </div>
  )
}
