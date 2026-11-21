import { useCallback, useState } from "react"
import {
  ActivityIcon,
  CircleUserRoundIcon,
  GiftIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  TagsIcon,
  WalletIcon,
} from "lucide-react"
import { Link } from "react-router"

import { RailBrand } from "@/components/app-brand"
import {
  RailContext,
  type RailContextValue,
} from "@/components/app-shell/rail-context"
import { useRailState } from "@/components/app-shell/use-rail-state"
import { NavUser } from "@/components/nav-user"
import { Sidebar, useSidebar } from "@/components/ui/sidebar"
import { useTargetPath } from "@/lib/route-target"

export const NAV_ITEMS = [
  { title: "总览", url: "/dashboard", icon: LayoutDashboardIcon },
  { title: "API 密钥", url: "/keys", icon: KeyRoundIcon },
  { title: "模型列表", url: "/models", icon: TagsIcon },
  { title: "用量记录", url: "/usage", icon: ActivityIcon },
  { title: "我的钱包", url: "/wallet", icon: WalletIcon },
  { title: "邀请返利", url: "/referral", icon: GiftIcon },
  { title: "个人资料", url: "/profile", icon: CircleUserRoundIcon },
] as const

const MOBILE_RAIL: RailContextValue = {
  expanded: true,
  remainingSettle: () => 0,
  setPopupOpen: () => undefined,
}

/**
 * Desktop: a 64px rail that expands to 268px over the content (demo.html).
 * Mobile (<768px): the same content inside the shadcn sheet.
 */
export function AppSidebar() {
  const { isMobile } = useSidebar()
  return isMobile ? <MobileSidebar /> : <DesktopRail />
}

function MobileSidebar() {
  const { setOpenMobile } = useSidebar()
  return (
    <Sidebar side="left">
      <RailContext.Provider value={MOBILE_RAIL}>
        <div className="rail-content bg-sidebar" data-expanded="true">
          <RailBody onNavigate={() => setOpenMobile(false)} />
        </div>
      </RailContext.Provider>
    </Sidebar>
  )
}

function DesktopRail() {
  const { open: pinned, setOpen } = useSidebar()
  const unpin = useCallback(() => setOpen(false), [setOpen])
  const { railRef, expanded, remainingSettle, setPopupOpen, handlers } =
    useRailState({ pinned, unpin })
  const context: RailContextValue = {
    expanded,
    remainingSettle,
    setPopupOpen,
  }

  return (
    <>
      {/* Reserves the collapsed width; the expanded rail floats over content. */}
      <div aria-hidden="true" className="w-16 shrink-0" />
      <aside
        ref={railRef}
        aria-label="侧边导航"
        className="rail"
        data-expanded={expanded}
        {...handlers}
      >
        <div className="rail-hitbox" aria-hidden="true" />
        <RailContext.Provider value={context}>
          <div className="rail-content" data-expanded={expanded}>
            <RailBody
              onNavigate={() => {
                if (pinned) setOpen(false)
              }}
            />
          </div>
        </RailContext.Provider>
      </aside>
    </>
  )
}

function RailBody({ onNavigate }: { onNavigate: () => void }) {
  // The target (not the committed) path: the rail answers the click in the
  // same frame while the page itself may still be loading.
  const pathname = useTargetPath()
  const activeIndex = NAV_ITEMS.findIndex((item) => item.url === pathname)

  // Replay the "just selected" confirmation only when the route changes
  // (state adjusted during render, not in an effect).
  const [lastPath, setLastPath] = useState(pathname)
  const [bounce, setBounce] = useState(0)
  if (lastPath !== pathname) {
    setLastPath(pathname)
    setBounce((count) => count + 1)
  }

  return (
    <>
      <RailBrand onNavigate={onNavigate} />
      <nav
        aria-label="主导航"
        className="relative flex min-h-0 flex-1 flex-col"
      >
        <div
          aria-hidden="true"
          className="rail-indicator"
          data-hidden={activeIndex < 0}
          style={{ "--i": Math.max(0, activeIndex) } as React.CSSProperties}
        >
          <div
            key={bounce}
            className="rail-indicator-pill"
            data-bounce={bounce > 0}
          />
        </div>
        <ul className="rail-nav">
          {NAV_ITEMS.map((item, index) => {
            const just = bounce > 0 && index === activeIndex
            // Re-keying only the inner spans replays the confirmation
            // animation without remounting the link (keeps keyboard focus).
            const replay = just ? bounce : 0
            return (
              <li key={item.url}>
                <Link
                  to={item.url}
                  onClick={onNavigate}
                  className="rail-item"
                  aria-current={index === activeIndex ? "page" : undefined}
                  data-just-selected={just}
                >
                  <span key={`icon-${replay}`} className="rail-icon">
                    <item.icon aria-hidden="true" />
                  </span>
                  <span
                    key={`label-${replay}`}
                    className="rail-label fade-item"
                  >
                    {item.title}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="rail-footer">
        <NavUser onNavigate={onNavigate} />
      </div>
    </>
  )
}
