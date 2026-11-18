import { NavLink } from "react-router"

import { useSiteStatus } from "@/hooks/use-queries"
import { BlipLogo } from "@/components/blip-logo"
import { cn } from "@/lib/utils"

const APP_NAME = "MLTVRS"

function withV(version: string) {
  return /^v/i.test(version) ? version : `v${version}`
}

/** Front-end version from package.json; back-end from `/api/status`. */
export function useVersions() {
  const { data } = useSiteStatus()
  return {
    fe: withV(__APP_VERSION__),
    be: data?.version ? withV(data.version) : "未知",
  }
}

/** Animated Blip mascot; palette follows the `.dark` theme class. */
function Logo({ className }: { className?: string }) {
  return <BlipLogo className={className} />
}

/** Logo tile: the artwork carries its own rounded-square background. */
export function BrandMark({
  compact = false,
  className,
}: {
  compact?: boolean
  className?: string
}) {
  return (
    <Logo
      className={cn("shrink-0", compact ? "size-8" : "size-[42px]", className)}
    />
  )
}

/** Static brand for pages outside the shell (sign-in, 404). */
export function AppBrand({
  compact = false,
  className,
}: {
  compact?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        "flex items-center",
        compact ? "gap-2.5" : "gap-3",
        className
      )}
      aria-label={APP_NAME}
    >
      <BrandMark compact={compact} />
      <span className="text-base font-semibold tracking-[0.4px]">
        {APP_NAME}
      </span>
    </span>
  )
}

/** Rail brand: logo (links home) + name. */
export function RailBrand({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="rail-brand">
      <NavLink
        to="/dashboard"
        className="rail-logo"
        aria-label={`${APP_NAME} · 返回总览`}
        onClick={onNavigate}
      >
        <Logo className="size-full" />
      </NavLink>

      <span className="rail-brand-name fade-item" aria-hidden="true">
        {APP_NAME}
      </span>
    </div>
  )
}
