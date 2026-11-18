import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Whole-page placeholder shown the moment a navigation starts, until the
 * next page has loaded and rendered. Each layout mirrors the real page
 * (same Card surfaces, same grid) so the hand-off to the page's own loading
 * state does not jump. All blocks share the viewport-anchored shimmer, which
 * reads as one sweep across the whole content area.
 */
export function RouteSkeleton({
  path,
  leaving = false,
}: {
  path: string
  /** The page has committed: fade out over it, then the parent unmounts. */
  leaving?: boolean
}) {
  const Layout = LAYOUTS[path] ?? GenericSkeleton
  return (
    <div
      data-route-skeleton=""
      data-leaving={leaving}
      role={leaving ? undefined : "status"}
      aria-hidden={leaving || undefined}
      aria-busy={!leaving}
      className="route-skeleton flex flex-col gap-6"
    >
      {!leaving && <span className="sr-only">页面加载中…</span>}
      <Layout />
    </div>
  )
}

function HeadingSkeleton({
  actions = 1,
  description = false,
}: {
  actions?: number
  description?: boolean
}) {
  return (
    <div className="flex flex-col gap-4 pb-1.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-9 w-56 rounded-lg bg-sk-strong" />
        {description && <Skeleton className="h-5 w-80 rounded-md bg-sk-soft" />}
      </div>
      <div className="flex items-center gap-3">
        {Array.from({ length: actions }, (_, index) => (
          <Skeleton key={index} className="h-9 w-32 rounded-xl" />
        ))}
        <Skeleton className="size-9 rounded-full max-md:hidden touch:hidden" />
      </div>
    </div>
  )
}

function StatSkeletons({
  className = "xl:grid-cols-4",
}: {
  className?: string
}) {
  return (
    <div className={`grid gap-6 sm:grid-cols-2 ${className}`}>
      {Array.from({ length: 4 }, (_, index) => (
        <Card key={index} className="justify-between gap-2 px-5 py-5">
          <div className="flex min-h-9 items-center gap-2">
            <Skeleton className="h-8 w-32 rounded-lg bg-sk-strong" />
            <Skeleton className="ml-auto h-5 w-12 rounded-md bg-sk-soft" />
          </div>
          <Skeleton className="h-5 w-24 rounded-md bg-sk-soft" />
        </Card>
      ))}
    </div>
  )
}

/** Icon-style KPI cards (usage page): tile, label, figure, caption. */
function IconStatSkeletons() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <Card key={index} className="flex-row items-start gap-4 px-5 py-5">
          <Skeleton className="size-11 shrink-0 rounded-xl" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-20 rounded-md bg-sk-soft" />
            <Skeleton className="h-7 w-28 rounded-lg bg-sk-strong" />
            <Skeleton className="h-4 w-36 rounded-md bg-sk-soft" />
          </div>
        </Card>
      ))}
    </div>
  )
}

function CardSkeleton({
  rows,
  rowClassName = "h-10",
  className,
  toolbar = 0,
  toolbarEnd = 0,
  actions = 1,
  description = true,
}: {
  rows: number
  rowClassName?: string
  className?: string
  /** Number of filter fields above the rows. */
  toolbar?: number
  /** Number of buttons at the right end of the filter row. */
  toolbarEnd?: number
  /** Number of header buttons on the right. */
  actions?: number
  description?: boolean
}) {
  return (
    <Card className={className}>
      <CardHeader className="grid-cols-[1fr_auto] items-center">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-28 rounded-md bg-sk-strong" />
          {description && (
            <Skeleton className="h-4 w-52 rounded-md bg-sk-soft" />
          )}
        </div>
        <div className="flex gap-2">
          {Array.from({ length: actions }, (_, index) => (
            <Skeleton key={index} className="h-8 w-24 rounded-xl" />
          ))}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {toolbar > 0 && (
          <div className="flex flex-wrap gap-2 pb-1">
            {Array.from({ length: toolbar }, (_, index) => (
              <Skeleton key={index} className="h-9 w-full rounded-xl sm:w-44" />
            ))}
            {toolbarEnd > 0 && (
              <div className="ml-auto flex gap-2">
                {Array.from({ length: toolbarEnd }, (_, index) => (
                  <Skeleton key={index} className="h-9 w-24 rounded-xl" />
                ))}
              </div>
            )}
          </div>
        )}
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className={`w-full ${rowClassName}`} />
        ))}
      </CardContent>
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <>
      <HeadingSkeleton />
      <StatSkeletons className="xl:grid-cols-[repeat(3,minmax(0,1fr))_320px]" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader className="grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-24 rounded-md bg-sk-strong" />
              <Skeleton className="h-8 w-40 rounded-lg bg-sk-strong" />
            </div>
            <Skeleton className="h-8 w-28 rounded-xl" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full rounded-md bg-sk-soft" />
          </CardContent>
        </Card>
        <CardSkeleton rows={3} rowClassName="h-12" />
      </div>
      <CardSkeleton rows={3} />
    </>
  )
}

function KeysSkeleton() {
  return (
    <>
      <HeadingSkeleton />
      <CardSkeleton rows={5} rowClassName="h-12" />
      <Skeleton className="h-20 w-full rounded-3xl bg-card" />
    </>
  )
}

function ModelsSkeleton() {
  return (
    <>
      <HeadingSkeleton />
      <ModelsBodySkeleton />
    </>
  )
}

/** Group list + card grid of /models; also the page's own loading state. */
export function ModelsBodySkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[14.5rem_minmax(0,1fr)] lg:items-start">
      <div className="flex gap-1.5 overflow-hidden lg:flex-col lg:gap-1">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton
            key={index}
            className="h-10 w-36 shrink-0 rounded-xl lg:w-full"
          />
        ))}
      </div>
      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-7 w-56 rounded-lg bg-sk-strong" />
          <div className="flex w-full gap-3 sm:w-auto">
            <Skeleton className="h-9 w-28 rounded-lg" />
            <Skeleton className="h-9 flex-1 rounded-xl sm:w-60 sm:flex-none" />
          </div>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17.5rem),1fr))] gap-5">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-80 rounded-3xl bg-card" />
          ))}
        </div>
      </div>
    </div>
  )
}

function UsageSkeleton() {
  return (
    <>
      <HeadingSkeleton actions={0} />
      <IconStatSkeletons />
      <CardSkeleton
        rows={5}
        rowClassName="h-12"
        toolbar={3}
        toolbarEnd={2}
        actions={0}
        description={false}
      />
    </>
  )
}

function WalletSkeleton() {
  return (
    <>
      <HeadingSkeleton />
      <StatSkeletons />
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <Skeleton key={index} className="h-72 rounded-3xl bg-card" />
        ))}
      </div>
    </>
  )
}

function ProfileSkeleton() {
  return (
    <>
      <HeadingSkeleton />
      <Skeleton className="h-32 w-full rounded-3xl bg-card" />
      <Skeleton className="h-64 w-full rounded-3xl bg-card" />
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => (
          <Skeleton key={index} className="h-64 rounded-3xl bg-card" />
        ))}
      </div>
    </>
  )
}

function SecuritySkeleton() {
  return (
    <>
      <HeadingSkeleton />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-3xl bg-card" />
        <Skeleton className="h-64 rounded-3xl bg-card" />
      </div>
      <Skeleton className="h-48 w-full rounded-3xl bg-card" />
    </>
  )
}

function GenericSkeleton() {
  return (
    <>
      <HeadingSkeleton />
      <CardSkeleton rows={6} />
    </>
  )
}

const LAYOUTS: Record<string, () => React.JSX.Element> = {
  "/dashboard": DashboardSkeleton,
  "/keys": KeysSkeleton,
  "/models": ModelsSkeleton,
  "/usage": UsageSkeleton,
  "/wallet": WalletSkeleton,
  "/profile": ProfileSkeleton,
  "/security": SecuritySkeleton,
}
