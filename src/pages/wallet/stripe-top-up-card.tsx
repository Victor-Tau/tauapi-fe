import { useEffect, useState } from "react"
import {
  focusManager,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { ExternalLinkIcon } from "lucide-react"

import { errorMessage } from "@/api/errors"
import {
  createStripeCheckout,
  getRecentTopUpOrders,
  getStripeQuote,
  type TopUpInfo,
} from "@/api/user"
import { ErrorAlert } from "@/components/error-alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { queryKeys } from "@/lib/query"
import type { SiteStatus } from "@/types/api"
import { formatQuota, formatUnixSeconds } from "@/utils/format"

const MAX_TOP_UP_AMOUNT = 10_000
const stripeMoney = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "HKD",
  currencyDisplay: "code",
})

const ORDER_STATUS: Record<string, string> = {
  pending: "等待支付确认",
  success: "已到账",
  failed: "支付失败",
  expired: "订单已过期",
}

export function StripeTopUpCard({
  config,
  info,
}: {
  config: SiteStatus | undefined
  info: TopUpInfo
}) {
  const queryClient = useQueryClient()
  const [input, setInput] = useState("")
  const quote = useMutation({ mutationFn: getStripeQuote })
  const checkout = useMutation({
    mutationFn: createStripeCheckout,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.topUpOrders })
    },
  })
  const checkoutLink = checkout.data

  useEffect(() => {
    if (!checkoutLink) return
    return focusManager.subscribe((focused) => {
      if (!focused) return
      void queryClient.invalidateQueries({ queryKey: queryKeys.topUpOrders })
      void queryClient.invalidateQueries({ queryKey: queryKeys.self })
      void queryClient.invalidateQueries({ queryKey: queryKeys.growthAll })
      void queryClient.invalidateQueries({ queryKey: ["balance-logs"] })
    })
  }, [checkoutLink, queryClient])

  const multiplier =
    config?.quota_display_type === "TOKENS" ? (config.quota_per_unit ?? 1) : 1
  const minimum = Math.max(1, info.stripe_min_topup * multiplier)
  const amount = Number(input)
  const valid =
    /^\d+$/.test(input) &&
    Number.isSafeInteger(amount) &&
    amount >= minimum &&
    amount <= MAX_TOP_UP_AMOUNT
  const presets = [...new Set(info.amount_options)].filter(
    (option) => option >= minimum && option <= MAX_TOP_UP_AMOUNT
  )
  const pending = quote.isPending || checkout.isPending
  const error = quote.error ?? checkout.error
  const inputLabel =
    config?.quota_display_type === "CNY" ? "充值额度（元）" : "充值额度"
  const submitLabel = quote.isSuccess ? "创建支付订单" : "获取 Stripe 报价"

  function changeAmount(value: string) {
    setInput(value)
    quote.reset()
    checkout.reset()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stripe 在线充值</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            if (!valid || pending || checkoutLink) return
            if (quote.isSuccess) checkout.mutate(amount)
            else quote.mutate(amount)
          }}
        >
          <Field data-invalid={Boolean(input && !valid) || undefined}>
            <FieldLabel htmlFor="stripe-top-up-amount">{inputLabel}</FieldLabel>
            <Input
              id="stripe-top-up-amount"
              inputMode="numeric"
              maxLength={5}
              value={input}
              onChange={(event) => changeAmount(event.target.value)}
              aria-describedby="stripe-top-up-limits"
              aria-invalid={Boolean(input && !valid)}
              autoComplete="off"
              disabled={pending}
            />
            <FieldDescription id="stripe-top-up-limits">
              {minimum <= MAX_TOP_UP_AMOUNT
                ? `请输入 ${minimum}–${MAX_TOP_UP_AMOUNT} 之间的整数。`
                : "当前 Stripe 最低充值额度超过单笔上限。"}
            </FieldDescription>
            {presets.length > 0 && (
              <ToggleGroup
                aria-label="预设充值额度"
                className="flex-wrap"
                spacing={2}
                variant="outline"
                size="sm"
                value={valid ? [String(amount)] : []}
                onValueChange={(value) => {
                  if (value[0] !== undefined) changeAmount(value[0])
                }}
              >
                {presets.map((option) => (
                  <ToggleGroupItem
                    key={option}
                    value={String(option)}
                    disabled={pending}
                  >
                    {option}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}
            <div aria-live="polite">
              {quote.data !== undefined && (
                <p>
                  预计支付{" "}
                  <strong className="tabular-nums">
                    {stripeMoney.format(quote.data)}
                  </strong>
                </p>
              )}
            </div>
            {error && (
              <FieldError role="alert">{errorMessage(error)}</FieldError>
            )}
            {checkoutLink ? (
              <>
                <Button
                  className="self-start"
                  nativeButton={false}
                  render={
                    <a
                      href={checkoutLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  }
                >
                  打开 Stripe 收银台 <ExternalLinkIcon data-icon="inline-end" />
                </Button>
                <FieldDescription>
                  最终金额以 Stripe 收银台为准。支付完成后回到此页查看到账状态。
                </FieldDescription>
              </>
            ) : (
              <Button
                type="submit"
                className="self-start"
                disabled={!valid || pending}
              >
                {pending ? "处理中…" : submitLabel}
              </Button>
            )}
          </Field>
        </form>
        <Separator />
        <StripeOrders config={config} />
      </CardContent>
    </Card>
  )
}

function StripeOrders({ config }: { config: SiteStatus | undefined }) {
  const orders = useQuery({
    queryKey: queryKeys.topUpOrders,
    queryFn: ({ signal }) => getRecentTopUpOrders(signal),
  })
  const rows =
    orders.data?.filter(
      (order) => (order.payment_provider || order.payment_method) === "stripe"
    ) ?? []

  return (
    <section aria-label="Stripe 充值记录" className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">Stripe 充值记录</h3>
      {orders.isPending && <Skeleton className="h-8 w-full" />}
      {orders.isError && (
        <ErrorAlert
          error={orders.error}
          onRetry={() => void orders.refetch()}
          retrying={orders.isFetching}
        />
      )}
      {orders.isSuccess && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          最近 10 笔充值订单中暂无 Stripe 记录。
        </p>
      )}
      {rows.length > 0 && (
        <ul className="divide-y">
          {rows.map((order) => (
            <li
              key={order.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
            >
              <span className="text-muted-foreground tabular-nums">
                {formatUnixSeconds(order.create_time)}
              </span>
              <span className="tabular-nums">
                {order.status === "success" ? "到账额度" : "充值额度"}{" "}
                {formatQuota(
                  config?.quota_per_unit
                    ? order.money * config.quota_per_unit
                    : null,
                  config
                )}
              </span>
              <Badge variant="outline">
                {ORDER_STATUS[order.status] ?? "状态未知"}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
