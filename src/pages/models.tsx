import { createContext, useContext, useMemo, useState } from "react"
import { ChevronRightIcon, SearchIcon, SearchXIcon } from "lucide-react"
import { useSearchParams } from "react-router"

import { ErrorAlert } from "@/components/error-alert"
import { ModelsBodySkeleton } from "@/components/route-skeleton"
import {
  GroupIcon,
  groupVendorIcon,
  type GroupVendorIcon,
} from "@/components/group-icon"
import { hasModelIcon, ModelIcon } from "@/components/model-icon"
import { CopyButton } from "@/components/copy-button"
import { PageHeading } from "@/components/page-heading"
import { RefreshButton } from "@/components/refresh-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Separator } from "@/components/ui/separator"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import {
  usePerfSummary,
  usePricing,
  useSelf,
  useSiteStatus,
  useUserModels,
} from "@/hooks/use-queries"
import { cn } from "@/lib/utils"
import type {
  ModelPerfSummary,
  PricingCatalog,
  PricingModel,
  PricingVendor,
  SiteStatus,
} from "@/types/api"
import { accountSpecial } from "@/utils/vip"
import { formatNumber, formatTokens } from "@/utils/format"
import {
  displayGroupRatio,
  formatUsd,
  groupRatioParts,
  modelPricing,
  PRICE_VARS,
  requestRuleText,
  tierConditionText,
  type GroupRatioParts,
  type ModelPricing,
  type PriceVar,
} from "@/utils/pricing"

const STATUS_HOURS = 24
/** Price lines shown on a card; every other variable is in the detail sheet. */
const CARD_VARS: PriceVar[] = ["p", "c", "cr", "cc"]
const VAR_LABEL = Object.fromEntries(PRICE_VARS) as Record<PriceVar, string>

type Health = "ok" | "degraded" | "failing" | "idle"

function healthOf(rate: number | undefined): Health {
  if (rate === undefined) return "idle"
  if (rate >= 99) return "ok"
  if (rate >= 90) return "degraded"
  return "failing"
}

const HEALTH_LABEL: Record<Health, string> = {
  ok: "正常",
  degraded: "波动",
  failing: "异常",
  idle: "暂无调用",
}
const HEALTH_TEXT: Record<Health, string> = {
  ok: "text-latency-good",
  degraded: "text-warning-text",
  failing: "text-destructive",
  idle: "text-muted-foreground",
}
const HEALTH_FILL: Record<Health, string> = {
  ok: "bg-latency-good",
  degraded: "bg-warning-text",
  failing: "bg-destructive",
  idle: "bg-nav-active",
}
/** Worse first: a group shows the state of its least healthy model. */
const HEALTH_RANK: Record<Health, number> = {
  failing: 3,
  degraded: 2,
  ok: 1,
  idle: 0,
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`
}

/** Decimals shared by every ratio on the page; derived from the catalog. */
const RatioDigitsContext = createContext(0)

function decimalsOf(value: number) {
  for (let d = 0; d < 3; d++) {
    if (Math.abs(Number(value.toFixed(d)) - value) < 1e-9) return d
  }
  return 3
}

/** "×1", "×0.1", "×0.095": as many decimals as the most precise ratio needs, so they line up. */
function formatRatio(ratio: number, digits: number) {
  return `×${ratio.toFixed(digits)}`
}

/** A user-group factor: "9.5折", "9折"; a surcharge stays a ratio ("×1.2"). */
function formatDiscount(factor: number, digits: number) {
  if (factor >= 1) return formatRatio(factor, digits)
  return `${Number((factor * 10).toFixed(2))}折`
}

/** "×0.1", or "×0.095 = 基础倍率 ×0.1 × 大学生优惠 9.5折" with a user-group factor. */
function ratioText(
  parts: GroupRatioParts,
  discountName: string,
  digits: number
) {
  const effective = formatRatio(parts.effective, digits)
  return parts.discount === null
    ? effective
    : `${effective} = 基础倍率 ${formatRatio(parts.base, digits)} × ${discountName} ${formatDiscount(parts.discount, digits)}`
}

function ratioBadgeText(ratio: number, digits: number): string | null {
  if (ratio > 1) return `基础价 ${formatRatio(ratio, digits)}`
  return null
}

interface GroupEntry {
  name: string
  /** Server description when set, else the group name. */
  label: string
  /** What this user pays: the group's own ratio × any user-group factor. */
  ratio: number
  /** The group's own ratio, before the user-group factor. */
  base: number
  /** Factor from the user's group (e.g. a student discount), if any. */
  discount: number | null
  usable: boolean
  models: PricingModel[]
  health: Health
  /** Shared by every model in the group; mixed groups get a generic mark. */
  icon: GroupVendorIcon
}

export default function ModelsPage() {
  const site = useSiteStatus()
  const self = useSelf()
  const pricing = usePricing()
  const perf = usePerfSummary(STATUS_HOURS)
  const userModels = useUserModels()
  const [searchParams, setSearchParams] = useSearchParams()

  const [search, setSearch] = useState("")

  const config = site.data
  const catalog = pricing.data
  // A user-group factor is named after the user's group (e.g. "大学生优惠").
  const discountName = accountSpecial(self.data) || "账户优惠"
  const vendorsById = useMemo(
    () => new Map((catalog?.vendors ?? []).map((v) => [v.id, v])),
    [catalog]
  )
  const perfByModel = useMemo(
    () => new Map((perf.data?.models ?? []).map((m) => [m.model_name, m])),
    [perf.data]
  )
  const available = useMemo(
    () => (userModels.data ? new Set(userModels.data) : null),
    [userModels.data]
  )

  const groups = useMemo<GroupEntry[]>(() => {
    if (!catalog) return []
    const byGroup = new Map<string, PricingModel[]>()
    for (const model of catalog.models) {
      for (const name of model.enable_groups) {
        const list = byGroup.get(name)
        if (list) list.push(model)
        else byGroup.set(name, [model])
      }
    }
    return [...byGroup]
      .map(([name, models]) => {
        models.sort((a, b) => a.model_name.localeCompare(b.model_name))
        const health = models
          .map((m) => healthOf(perfByModel.get(m.model_name)?.success_rate))
          .reduce<Health>(
            (worst, h) => (HEALTH_RANK[h] > HEALTH_RANK[worst] ? h : worst),
            "idle"
          )
        const parts = groupRatioParts(catalog, name)
        return {
          name,
          label: catalog.usable_group[name]?.trim() || name,
          ratio: parts.effective,
          base: parts.base,
          discount: parts.discount,
          usable: name in catalog.usable_group,
          models,
          health,
          icon: groupVendorIcon(models, vendorsById),
        }
      })
      .sort(
        (a, b) =>
          Number(b.usable) - Number(a.usable) ||
          a.ratio - b.ratio ||
          a.name.localeCompare(b.name)
      )
  }, [catalog, perfByModel, vendorsById])

  // Every ratio shares one precision.
  const ratioDigits = useMemo(
    () =>
      Math.max(
        0,
        ...groups.flatMap((g) => [decimalsOf(g.ratio), decimalsOf(g.base)])
      ),
    [groups]
  )

  // The group lives in the URL so a refresh or shared link keeps it.
  const requested = searchParams.get("group")
  const current =
    groups.find((g) => g.name === requested) ?? groups.at(0) ?? null

  function selectGroup(name: string) {
    setSearchParams(
      (params) => {
        params.set("group", name)
        return params
      },
      { replace: true }
    )
  }

  const models = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (current?.models ?? []).filter((model) => {
      if (!query) return true
      return [model.model_name, model.description ?? ""].some((text) =>
        text.toLowerCase().includes(query)
      )
    })
  }, [current, search])

  const sorted = useMemo(() => rowsBySeries(models).flat(), [models])

  const filtered = search.trim() !== ""
  const fetching = pricing.isFetching || perf.isFetching
  const perfState = perf.isPending
    ? "loading"
    : perf.isSuccess
      ? "ready"
      : "error"

  function resetFilters() {
    setSearch("")
  }

  return (
    <RatioDigitsContext.Provider value={ratioDigits}>
      <div className="flex flex-col gap-6">
        <PageHeading title="模型列表">
          <RefreshButton
            fetching={fetching}
            label="刷新"
            onRefresh={() => {
              void pricing.refetch()
              void perf.refetch()
              void userModels.refetch()
            }}
          />
        </PageHeading>

        {pricing.isError && (
          <ErrorAlert
            title="无法读取模型价格"
            error={pricing.error}
            onRetry={() => void pricing.refetch()}
            retrying={pricing.isFetching}
          />
        )}
        {perf.isError && (
          <ErrorAlert
            title="无法读取模型状态"
            error={perf.error}
            onRetry={() => void perf.refetch()}
            retrying={perf.isFetching}
          />
        )}

        {pricing.isPending ? (
          <ModelsBodySkeleton />
        ) : catalog && groups.length === 0 ? (
          <Empty className="bg-card">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchXIcon />
              </EmptyMedia>
              <EmptyTitle>暂无可展示的模型</EmptyTitle>
              <EmptyDescription>
                服务器还没有公开任何模型价格。
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : current && catalog ? (
          // Below lg the group list turns into a scrolling row above the cards,
          // so two vertical navs never sit side by side next to the app rail.
          <div className="grid gap-6 lg:grid-cols-[14.5rem_minmax(0,1fr)] lg:items-start">
            <GroupNav
              groups={groups}
              current={current.name}
              perfReady={perf.isSuccess}
              onSelect={selectGroup}
            />

            <section
              aria-labelledby="model-group-title"
              className="flex min-w-0 flex-col gap-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2
                    key={current.name}
                    id="model-group-title"
                    className="swap-value truncate font-heading text-lg font-semibold"
                    title={current.name}
                  >
                    {current.label}
                  </h2>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {formatNumber(current.models.length)} 个模型
                  </span>
                  <span className="text-sm text-muted-foreground">
                    倍率{" "}
                    <span className="font-mono text-foreground tabular-nums">
                      {formatRatio(current.ratio, ratioDigits)}
                    </span>
                    {current.discount !== null && (
                      <>
                        {" = 基础倍率 "}
                        <span className="font-mono tabular-nums">
                          {formatRatio(current.base, ratioDigits)}
                        </span>
                        {` × ${discountName} `}
                        <span className="text-foreground tabular-nums">
                          {formatDiscount(current.discount, ratioDigits)}
                        </span>
                      </>
                    )}
                  </span>
                  {!current.usable && (
                    <Badge variant="outline">当前账户不可用</Badge>
                  )}
                </div>
                <div className="flex w-full items-center gap-3 sm:w-auto">
                  <InputGroup className="min-w-0 flex-1 sm:w-60 sm:flex-none">
                    <InputGroupInput
                      placeholder="搜索模型"
                      aria-label="搜索模型"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                    <InputGroupAddon>
                      <SearchIcon />
                    </InputGroupAddon>
                  </InputGroup>
                </div>
              </div>

              {models.length ? (
                // Columns follow the space left beside the group list, not the
                // viewport, so they hold up whatever the rail is doing.
                // Re-keyed per group so the cards rise in on every switch.
                <div
                  key={current.name}
                  className="swap-in grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
                >
                  {sorted.map((model) => (
                    <ModelCard
                      key={model.model_name}
                      model={model}
                      vendor={vendorsById.get(model.vendor_id ?? -1)}
                      ratio={groupRatioParts(catalog, current.name)}
                      discountName={discountName}
                      perf={perfByModel.get(model.model_name)}
                      perfState={perfState}
                      windowEnd={perf.data?.window_end}
                      available={available?.has(model.model_name)}
                      config={config}
                      catalog={catalog}
                      group={current.name}
                      perfLoaded={perf.isSuccess}
                    />
                  ))}
                </div>
              ) : (
                <Empty className="bg-card">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <SearchXIcon />
                    </EmptyMedia>
                    <EmptyTitle>没有符合条件的模型</EmptyTitle>
                    <EmptyDescription>
                      尝试调整搜索词，或切换到其他分组。
                    </EmptyDescription>
                  </EmptyHeader>
                  {filtered && (
                    <EmptyContent>
                      <Button variant="outline" onClick={resetFilters}>
                        查看全部模型
                      </Button>
                    </EmptyContent>
                  )}
                </Empty>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </RatioDigitsContext.Provider>
  )
}

const SERIES_RE = /^gpt-(\d+(?:\.\d+)?)-([a-z]+)$/
// claude-opus-4-8-max / claude-sonnet-4-20250514 and claude-3-5-haiku-20241022.
const CLAUDE_NEW_RE = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-(.*))?$/
const CLAUDE_OLD_RE = /^claude-(\d+)(?:-(\d+))?-([a-z]+)(?:-(.*))?$/
const CLAUDE_FAMILIES = ["fable", "opus", "sonnet", "haiku"]

function claudeParts(name: string) {
  const n = CLAUDE_NEW_RE.exec(name)
  if (n && CLAUDE_FAMILIES.includes(n[1])) {
    return { family: n[1], version: Number(n[2]) + Number(n[3] ?? 0) / 100 }
  }
  const o = CLAUDE_OLD_RE.exec(name)
  if (o && CLAUDE_FAMILIES.includes(o[3])) {
    return { family: o[3], version: Number(o[1]) + Number(o[2] ?? 0) / 100 }
  }
  return null
}

/**
 * Lays GPT models out one series per row (gpt-6.2-astra, gpt-6-astra / then
 * gpt-6.2-sol, gpt-6.1-sol, ...), newest version first. Series with a single
 * model and every other name (codex-auto-review, gpt-5.6-luna, ...) share the
 * last row. Claude models get one row per family (fable, opus, sonnet,
 * haiku), newest first. Models that are not versioned GPT names keep one alphabetical row.
 */
function rowsBySeries(models: PricingModel[]): PricingModel[][] {
  const series = new Map<string, { version: number; model: PricingModel }[]>()
  const rest: PricingModel[] = []
  const claude = new Map<string, { version: number; model: PricingModel }[]>()
  for (const model of models) {
    const c = claudeParts(model.model_name)
    if (c) {
      const list = claude.get(c.family)
      const entry = { version: c.version, model }
      if (list) list.push(entry)
      else claude.set(c.family, [entry])
      continue
    }
    const m = SERIES_RE.exec(model.model_name)
    if (!m) {
      rest.push(model)
      continue
    }
    const list = series.get(m[2])
    const entry = { version: Number(m[1]), model }
    if (list) list.push(entry)
    else series.set(m[2], [entry])
  }

  const rows: { newest: number; name: string; models: PricingModel[] }[] = []
  for (const [name, list] of series) {
    list.sort(
      (a, b) =>
        b.version - a.version ||
        a.model.model_name.localeCompare(b.model.model_name)
    )
    if (list.length > 1) {
      rows.push({
        newest: list[0].version,
        name,
        models: list.map((e) => e.model),
      })
    } else {
      rest.push(list[0].model)
    }
  }
  rows.sort((a, b) => b.newest - a.newest || a.name.localeCompare(b.name))

  const out = rows.map((r) => r.models)
  // Claude: fable first, haiku last; newest version first within a family.
  for (const family of CLAUDE_FAMILIES) {
    const list = claude.get(family)
    if (!list) continue
    list.sort(
      (a, b) =>
        b.version - a.version ||
        a.model.model_name.localeCompare(b.model.model_name)
    )
    out.push(list.map((e) => e.model))
  }
  if (rest.length) {
    out.push(rest.sort((a, b) => a.model_name.localeCompare(b.model_name)))
  }
  return out
}

/**
 * Group switcher. lg+: a sticky column (clear of the rail's hover strip,
 * which stops 24px past the 64px rail while content starts at 104px).
 * Below lg: one horizontally scrolling row.
 */
function GroupNav({
  groups,
  current,
  perfReady,
  onSelect,
}: {
  groups: GroupEntry[]
  current: string
  perfReady: boolean
  onSelect: (name: string) => void
}) {
  const digits = useContext(RatioDigitsContext)
  return (
    <nav
      aria-label="模型分组"
      className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:-mx-10 md:px-10 lg:sticky lg:top-6 lg:mx-0 lg:overflow-visible lg:px-0 touch:lg:top-20"
    >
      <ul className="flex gap-1.5 lg:flex-col lg:gap-1">
        {groups.map((group) => {
          const active = group.name === current
          return (
            <li key={group.name} className="shrink-0 lg:w-full">
              <button
                type="button"
                aria-current={active ? "true" : undefined}
                onClick={() => onSelect(group.name)}
                title={group.label === group.name ? undefined : group.name}
                className={cn(
                  "press flex h-10 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring max-lg:bg-card",
                  active
                    ? "bg-nav-active! font-medium text-foreground"
                    : "text-muted-foreground hover:bg-(--control-hover) hover:text-foreground"
                )}
              >
                <span className="flex size-6 shrink-0 items-center justify-center">
                  <GroupIcon
                    name={group.name}
                    icon={group.icon}
                    className="size-[18px]"
                  />
                </span>
                <span className="min-w-0 flex-1 truncate">{group.label}</span>
                <span className="min-w-12 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">
                  {formatRatio(group.ratio, digits)}
                </span>
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    perfReady ? HEALTH_FILL[group.health] : "bg-nav-active"
                  )}
                  role="img"
                  aria-label={
                    perfReady
                      ? `状态：${HEALTH_LABEL[group.health]}`
                      : "状态加载中"
                  }
                />
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function ModelCard({
  model,
  vendor,
  ratio,
  discountName,
  perf,
  perfState,
  windowEnd,
  available,
  config,
  catalog,
  group,
  perfLoaded,
}: {
  model: PricingModel
  vendor: PricingVendor | undefined
  ratio: GroupRatioParts
  discountName: string
  perf: ModelPerfSummary | undefined
  perfState: "loading" | "ready" | "error"
  windowEnd: number | undefined
  available: boolean | undefined
  config: SiteStatus | undefined
  catalog: PricingCatalog
  group: string
  perfLoaded: boolean
}) {
  const pricing = modelPricing(model, config)
  const health = healthOf(perf?.success_rate)
  // The group's own standing; the user's factor is shown on the prices.
  const digits = useContext(RatioDigitsContext)
  const badge = ratioBadgeText(ratio.base, digits)
  const vendorName = vendor?.name
  const initial = (vendorName || model.model_name).slice(0, 1).toUpperCase()

  return (
    <Card
      size="sm"
      className="gap-2.5 rounded-2xl [--card-spacing:--spacing(3.5)]"
    >
      <CardHeader className="grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3">
        <div
          className="flex size-8 items-center justify-center rounded-lg bg-nav-active font-heading text-sm font-semibold"
          title={vendorName}
        >
          {hasModelIcon(model.model_name, vendor) ? (
            <ModelIcon
              model={model.model_name}
              vendor={vendor}
              className="size-4"
            />
          ) : (
            <span aria-hidden="true">{initial}</span>
          )}
        </div>
        <div className="flex min-w-0 flex-col justify-center gap-1">
          <div className="flex min-w-0 items-center gap-1">
            <span className="truncate font-mono text-base leading-6 font-semibold">
              {model.model_name}
            </span>
            <CopyButton
              variant="ghost"
              size="icon-xs"
              className="shrink-0 text-muted-foreground"
              aria-label={`复制模型名称 ${model.model_name}`}
              text={model.model_name}
              what="模型名称"
            />
          </div>
          {available === false && (
            <div className="flex min-w-0 items-center gap-2 text-xs">
              <Badge variant="outline" className="shrink-0">
                无权限
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-2">
        <div className="flex min-h-6 items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {pricing.kind === "request"
              ? "按次计费"
              : pricing.kind === "custom"
                ? "自定义计价"
                : "每 1M tokens"}
            {pricing.kind === "tokens" && pricing.tiers.length > 1 && (
              <span className="ml-1 text-[11px] opacity-80">
                ({tierConditionText(pricing.tiers, 0, true)})
              </span>
            )}
          </span>
          {badge && <Badge variant="neutral">{badge}</Badge>}
        </div>
        <CardPrices pricing={pricing} ratio={ratio} config={config} />
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-2 border-t-0 bg-transparent pt-0">
        <Separator />
        {perfState === "loading" ? (
          <Skeleton className="h-4 w-full rounded-sm" />
        ) : (
          <HourlyStrip perf={perf} windowEnd={windowEnd} />
        )}
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          {perfState === "loading" ? (
            <Skeleton className="h-4 w-40 rounded-sm" />
          ) : (
            <span className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  "flex shrink-0 items-center gap-1.5",
                  HEALTH_TEXT[health]
                )}
              >
                <span
                  className="size-2 shrink-0 rounded-full bg-current"
                  aria-hidden="true"
                />
                {perfState === "error" ? "状态未知" : HEALTH_LABEL[health]}
              </span>
              <span className="truncate tabular-nums">
                {perf
                  ? `成功率 ${formatPercent(perf.success_rate)}`
                  : perfState === "error"
                    ? "数据暂不可用"
                    : "..."}
              </span>
            </span>
          )}
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="xs"
                  className="-mr-1.5 text-muted-foreground"
                />
              }
            >
              全部价格
              <ChevronRightIcon data-icon="inline-end" />
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              align="end"
              sideOffset={6}
              collisionPadding={12}
              className="max-h-(--available-height) w-[24rem] max-w-[calc(100vw-1.5rem)] gap-0 overflow-y-auto p-0"
            >
              <ModelDetail
                model={model}
                catalog={catalog}
                vendorName={vendorName}
                perf={perf}
                perfLoaded={perfLoaded}
                windowEnd={windowEnd}
                available={available}
                group={group}
                discountName={discountName}
                config={config}
              />
            </PopoverContent>
          </Popover>
        </div>
      </CardFooter>
    </Card>
  )
}

function CardPrices({
  pricing,
  ratio,
  config,
}: {
  pricing: ModelPricing
  ratio: GroupRatioParts
  config: SiteStatus | undefined
}) {
  if (pricing.kind === "custom") {
    return (
      <p className="line-clamp-4 font-mono text-xs break-all text-muted-foreground">
        {pricing.expression}
      </p>
    )
  }
  const [tier] = pricing.tiers
  if (!tier) return null
  const price = (usd: number) => (usd === 0 ? "免费" : formatUsd(usd, config))
  // [label, what the user pays, list price (×1) when the user pays less]
  const rows: [string, string, string | null][] = (
    tier.fixed !== undefined
      ? [["每次请求", tier.fixed] as const]
      : CARD_VARS.filter((key) => tier.prices[key] !== undefined).map(
          (key) => [VAR_LABEL[key], tier.prices[key]!] as const
        )
  ).map(([label, usd]) => [
    label,
    price(usd * ratio.effective),
    ratio.effective < 1 && usd > 0 ? price(usd) : null,
  ])

  return (
    <dl className="flex flex-col gap-1.5 text-sm">
      {rows.map(([label, value, before]) => (
        <div key={label} className="flex items-center justify-between gap-4">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="flex items-baseline gap-2 tabular-nums">
            {before && (
              <s
                className="text-xs text-muted-foreground"
                title="官方标价（倍率 ×1）"
              >
                {before}
              </s>
            )}
            <span className="font-semibold">{value}</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}

const hourFormat = new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

/** One segment per hour of the window; hours without calls stay muted. */
function HourlyStrip({
  perf,
  windowEnd,
  showAxis = false,
}: {
  perf: ModelPerfSummary | undefined
  windowEnd: number | undefined
  showAxis?: boolean
}) {
  const series = perf?.recent_success_series ?? []
  // Anchor on the server's window; fall back to the newest data point.
  const end = windowEnd ?? Math.max(0, ...series.map((point) => point.ts))
  const lastHour = Math.floor(end / 3600) * 3600
  const byHour = new Map(
    series.map((point) => [
      Math.floor(point.ts / 3600) * 3600,
      point.success_rate,
    ])
  )
  const slots = Array.from({ length: STATUS_HOURS }, (_, index) => {
    const ts = lastHour - (STATUS_HOURS - 1 - index) * 3600
    return { ts, rate: byHour.get(ts) }
  })
  const active = slots.filter((slot) => slot.rate !== undefined).length

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="flex h-4 gap-[3px]"
        role="img"
        aria-label={`近 24 小时中有 ${active} 个小时产生调用`}
      >
        {slots.map(({ ts, rate }) => (
          <div
            key={ts}
            title={`${hourFormat.format(ts * 1000)} · ${rate === undefined ? "无调用" : `成功率 ${formatPercent(rate)}`}`}
            className={cn(
              "flex-1 rounded-[3px] transition-[scale] duration-200 ease-(--ease-spring-pop) hover:scale-y-125",
              HEALTH_FILL[healthOf(rate)]
            )}
          />
        ))}
      </div>
      {showAxis && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>24 小时前</span>
          <span>现在</span>
        </div>
      )}
    </div>
  )
}

function ModelDetail({
  model,
  catalog,
  vendorName,
  perf,
  perfLoaded,
  windowEnd,
  available,
  group,
  discountName,
  config,
}: {
  model: PricingModel | undefined
  catalog: PricingCatalog | undefined
  vendorName: string | undefined
  perf: ModelPerfSummary | undefined
  perfLoaded: boolean
  windowEnd: number | undefined
  available: boolean | undefined
  group: string | undefined
  discountName: string
  config: SiteStatus | undefined
}) {
  const ratio =
    model && catalog ? displayGroupRatio(model, catalog.group_ratio, group) : 1
  const digits = useContext(RatioDigitsContext)
  const pricing = model ? modelPricing(model, config) : null
  const health = healthOf(perf?.success_rate)

  return (
    <>
      <div className="flex flex-col gap-0.5 px-5 pt-4 pb-3">
        <h2 className="font-mono font-medium break-all">{model?.model_name}</h2>
        <p className="text-xs text-muted-foreground">
          {[vendorName, model?.description].filter(Boolean).join(" · ") ||
            "模型计费与运行状态"}
        </p>
      </div>
      {model && catalog && pricing && (
        <div className="flex flex-col gap-6 px-5 pb-6">
          <section className="flex flex-col gap-3">
            <div className="flex items-baseline gap-2">
              <h3 className="font-medium">全部价格</h3>
            </div>
            {pricing.kind === "custom" ? (
              <>
                <p className="text-muted-foreground">
                  此模型使用自定义计价表达式，单价随请求内容变化：
                </p>
                <pre className="overflow-x-auto rounded-xl bg-popover-inner p-3 font-mono text-xs break-all whitespace-pre-wrap">
                  {pricing.expression}
                </pre>
              </>
            ) : (
              pricing.tiers.map((tier, index) => {
                const condition = tierConditionText(pricing.tiers, index)
                return (
                  <div
                    key={index}
                    className="flex flex-col rounded-xl bg-popover-inner"
                  >
                    {(condition || pricing.tiers.length > 1) && (
                      <div className="border-b border-divider px-3 py-2 text-xs text-muted-foreground">
                        {condition ?? `第 ${index + 1} 档`}
                      </div>
                    )}
                    <dl className="flex flex-col px-3">
                      {tier.fixed !== undefined ? (
                        <DetailRow
                          label="每次请求"
                          value={
                            tier.fixed * ratio === 0
                              ? "免费"
                              : formatUsd(tier.fixed * ratio, config)
                          }
                        />
                      ) : (
                        PRICE_VARS.filter(
                          ([key]) => tier.prices[key] !== undefined
                        ).map(([key, label]) => (
                          <DetailRow
                            key={key}
                            label={label}
                            value={`${formatUsd(tier.prices[key]! * ratio, config)} / 1M tokens`}
                          />
                        ))
                      )}
                    </dl>
                  </div>
                )
              })
            )}
            {pricing.kind !== "custom" && pricing.rules.length > 0 && (
              <div className="flex flex-col rounded-xl bg-popover-inner">
                <div className="border-b border-divider px-3 py-2 text-xs text-muted-foreground">
                  服务挡位倍率
                </div>
                <dl className="flex flex-col px-3">
                  <DetailRow label="Standard" value="×1" />
                  {pricing.rules.map((rule, index) => (
                    <DetailRow
                      key={index}
                      label={requestRuleText(rule)}
                      value={`×${rule.multiplier}`}
                    />
                  ))}
                </dl>
              </div>
            )}
          </section>

          <Separator />

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium">可用分组</h3>
              {available !== undefined && (
                <Badge variant={available ? "success" : "neutral"}>
                  {available ? "当前账户可调用" : "当前账户无权限"}
                </Badge>
              )}
            </div>
            {model.enable_groups.length ? (
              <dl className="flex flex-col">
                {model.enable_groups.map((name) => (
                  <DetailRow
                    key={name}
                    label={name}
                    value={ratioText(
                      groupRatioParts(catalog, name),
                      discountName,
                      digits
                    )}
                  />
                ))}
              </dl>
            ) : (
              <p className="text-muted-foreground">服务器未提供分组信息。</p>
            )}
          </section>

          <Separator />

          <section className="flex flex-col gap-3">
            <h3 className="font-medium">支持的接口</h3>
            {model.supported_endpoint_types.length ? (
              <ul className="flex flex-col gap-2">
                {model.supported_endpoint_types.map((type) => {
                  const endpoint = catalog.supported_endpoint[type]
                  return (
                    <li
                      key={type}
                      className="flex items-center justify-between gap-3"
                    >
                      <Badge variant="outline">{type}</Badge>
                      {endpoint && (
                        <code className="truncate font-mono text-xs text-muted-foreground">
                          {endpoint.method} {endpoint.path}
                        </code>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-muted-foreground">服务器未提供接口信息。</p>
            )}
          </section>

          <Separator />

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium">近 24 小时状态</h3>
              {perfLoaded && (
                <span
                  className={cn(
                    "flex items-center gap-1.5 text-sm",
                    HEALTH_TEXT[health]
                  )}
                >
                  <span
                    className="size-2 rounded-full bg-current"
                    aria-hidden="true"
                  />
                  {HEALTH_LABEL[health]}
                </span>
              )}
            </div>
            {perf ? (
              <>
                <dl className="grid grid-cols-2 gap-2 text-center">
                  {[
                    ["成功率", formatPercent(perf.success_rate)],
                    ["输出速度", `${formatTokens(perf.avg_tps)} tok/s`],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-xl bg-popover-inner px-2 py-2.5"
                    >
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="font-medium tabular-nums">{value}</dd>
                    </div>
                  ))}
                </dl>
                <HourlyStrip perf={perf} windowEnd={windowEnd} showAxis />
              </>
            ) : (
              <p className="text-muted-foreground">
                {perfLoaded
                  ? "近 24 小时没有该模型的调用记录。"
                  : "状态数据暂不可用。"}
              </p>
            )}
          </section>
        </div>
      )}
    </>
  )
}

function DetailRow({
  label,
  value,
}: {
  label: React.ReactNode
  value: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b py-2 last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{value}</dd>
    </div>
  )
}
