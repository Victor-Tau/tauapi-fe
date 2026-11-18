import { AppBrand } from "@/components/app-brand"
import { ModeToggle } from "@/components/mode-toggle"
import { SidebarTrigger } from "@/components/ui/sidebar"

/**
 * Compact top bar for phones and touch tablets only. On a hovering desktop
 * the page heading is the top bar (demo.html), so this is hidden there.
 * The trigger opens the mobile sheet (<768px) or pins the rail open (touch).
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 hidden h-14 shrink-0 items-center gap-2 bg-glass pl-4 pr-12 backdrop-blur-md max-md:flex touch:flex">
      <SidebarTrigger
        className="-ml-1 size-9 rounded-md"
        aria-label="打开导航"
      />
      <AppBrand compact />
      <ModeToggle className="ml-auto" />
    </header>
  )
}
