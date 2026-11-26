import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ExternalLinkIcon, TicketIcon } from "lucide-react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { redeemCode } from "@/api/user"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { queryKeys } from "@/lib/query"
import type { SiteStatus } from "@/types/api"
import { formatQuota } from "@/utils/format"

/** Redeeming a code into the balance, plus the admin's top-up link. */
export function RedeemCard({
  config,
  topUpLink,
  className,
}: {
  config: SiteStatus | undefined
  topUpLink: string | undefined
  className?: string
}) {
  const queryClient = useQueryClient()
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)

  const redeem = useMutation({
    mutationFn: (value: string) => redeemCode(value),
    onMutate: () => setError(null),
    onSuccess: (quota) => {
      setCode("")
      toast.success(`兑换成功，已到账 ${formatQuota(quota, config)}`)
      void queryClient.invalidateQueries({ queryKey: queryKeys.self })
      void queryClient.invalidateQueries({ queryKey: queryKeys.growthAll })
    },
    // Not retried: a code is single-use and the server rate-limits redeeming.
    onError: (cause) => setError(errorMessage(cause)),
  })

  const trimmed = code.trim()

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>余额充值</CardTitle>
        {topUpLink && (
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={
                <a href={topUpLink} target="_blank" rel="noopener noreferrer" />
              }
            >
              <ExternalLinkIcon data-icon="inline-start" />
              购买兑换码
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            if (trimmed && !redeem.isPending) redeem.mutate(trimmed)
          }}
        >
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="redeem-code">兑换额度</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="redeem-code"
                value={code}
                onChange={(event) => {
                  setCode(event.target.value)
                  if (error) setError(null)
                }}
                placeholder="请输入兑换码"
                autoComplete="off"
                spellCheck={false}
                maxLength={64}
                aria-invalid={error ? true : undefined}
                disabled={redeem.isPending}
              />
              <Button type="submit" disabled={!trimmed || redeem.isPending}>
                <TicketIcon data-icon="inline-start" />
                {redeem.isPending ? "兑换中…" : "兑换"}
              </Button>
            </div>
            {error && <FieldError>{error}</FieldError>}
          </Field>
        </form>
      </CardContent>
    </Card>
  )
}
