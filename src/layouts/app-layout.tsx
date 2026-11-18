import { useEffect, useState } from "react"
import { Outlet, useLocation } from "react-router"

import { AppSidebar } from "@/components/app-sidebar"
import { ConnectionIndicator } from "@/components/connection-status"
import { ErrorAlert } from "@/components/error-alert"
import { RouteSkeleton } from "@/components/route-skeleton"
import { SiteHeader } from "@/components/site-header"
import { SidebarProvider } from "@/components/ui/sidebar"
import { useSelf } from "@/hooks/use-queries"
import { useTargetPath } from "@/lib/route-target"

/** Matches the skeleton's fade-out in styles/motion.css (.route-skeleton). */
const SKELETON_FADE_MS = 220

export function AppLayout() {
  const self = useSelf()
  // The target path updates synchronously on click; the committed location
  // follows once the page is ready. In between, the content area shows the
  // target page's skeleton instead of freezing on the previous page.
  const target = useTargetPath()
  const { pathname } = useLocation()
  const switching = target !== pathname

  // The skeleton outlives the switch by one short fade, so the next page
  // rises in underneath it instead of replacing it in a single frame.
  const [skeleton, setSkeleton] = useState<string | null>(null)
  if (switching && skeleton !== target) setSkeleton(target)
  const skeletonLeaving = !switching && skeleton !== null
  useEffect(() => {
    if (!skeletonLeaving) return
    const id = window.setTimeout(() => setSkeleton(null), SKELETON_FADE_MS)
    return () => window.clearTimeout(id)
  }, [skeletonLeaving])

  return (
    // `open` is the pinned state of the rail (Ctrl/⌘+B or the touch toggle);
    // hover and keyboard focus expand it without pinning.
    <SidebarProvider defaultOpen={false} className="bg-background">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <SiteHeader />
        <main className="mx-auto flex w-full max-w-[1480px] flex-1 flex-col gap-6 px-4 pt-4 pb-10 md:px-10 md:pt-[26px] md:pb-12">
          {self.isError && (
            <ErrorAlert
              title="无法读取账户信息"
              error={self.error}
              onRetry={() => void self.refetch()}
              retrying={self.isFetching}
            />
          )}
          {/* Skeleton and page share one grid cell so they can cross-fade.
              The previous page stays mounted (fading out) until the next one
              commits: unmounting it on the click frame would cost as much as
              the skeleton saves. Keying by pathname replays the entrance. */}
          <div className="page-stage">
            {skeleton && (
              <RouteSkeleton
                // Siblings of the page view: keys are namespaced so a skeleton
                // and the page of the same path never collide.
                key={`skeleton:${skeleton}`}
                path={skeleton}
                leaving={skeletonLeaving}
              />
            )}
            <div
              key={`page:${pathname}`}
              className="page-view"
              data-leaving={switching}
            >
              <Outlet />
            </div>
          </div>
        </main>
      </div>
      <ConnectionIndicator />
    </SidebarProvider>
  )
}
