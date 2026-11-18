import { useRef, useState } from "react"
import { LogOutIcon, UserCogIcon } from "lucide-react"
import { useNavigate } from "react-router"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import {
  POPOVER_DELAY,
  RAIL_ENTER_DELAY,
  RAIL_SETTLE_TIME,
  useRail,
} from "@/components/app-shell/rail-context"
import { AvatarFrame } from "@/components/avatar-frame"
import { PebbleAvatar } from "@/components/pebble-avatar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/hooks/use-auth"
import { useSelf, useVipConfig } from "@/hooks/use-queries"
import { GroupBadge, VipBadge } from "@/pages/profile/vip-badges"
import { accountSpecial, accountTier, frameBadge } from "@/utils/vip"

/**
 * Footer user card. On a hovering mouse the menu opens upwards (same width as
 * the card) once the rail has expanded; click, Enter/Space and tap open it
 * too, and the arrow keys move through the items.
 */
export function NavUser({ onNavigate }: { onNavigate: () => void }) {
  const { user, logout } = useAuth()
  const { data: profile } = useSelf()
  const navigate = useNavigate()
  const { expanded, setPopupOpen } = useRail()
  const [pending, setPending] = useState(false)
  // Base UI moves focus into any menu it opens. For a hover-open, remember
  // what had focus (e.g. a half-typed field) and give it back on close.
  const hoverOpened = useRef(false)
  const returnFocus = useRef<HTMLElement | null>(null)

  const account = profile ?? user
  const name = account?.display_name || account?.username || "我的账户"
  // Same badges as the profile page: the tier always, the offer only when the account has one.
  const { tiers } = useVipConfig()
  const tier = accountTier(account ?? undefined, tiers)
  const special = accountSpecial(account ?? undefined)
  const badges =
    tier || special ? (
      <span className="flex items-center gap-1.5 overflow-hidden pt-0.5">
        {tier && <VipBadge short tier={tier} className="h-5 px-2" />}
        {special && <GroupBadge group={special} className="h-5 px-2" />}
      </span>
    ) : (
      <span className="truncate text-xs text-muted-foreground">未分组</span>
    )
  const initial = name.slice(0, 1).toUpperCase()

  async function signOut() {
    if (pending) return
    setPending(true)
    try {
      await logout()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
      void navigate("/login", { replace: true })
    }
  }

  return (
    <DropdownMenu
      modal={false}
      onOpenChange={(open, details) => {
        if (open) {
          hoverOpened.current = details.reason === "trigger-hover"
          const active = document.activeElement
          returnFocus.current =
            hoverOpened.current &&
            active instanceof HTMLElement &&
            active !== document.body
              ? active
              : null
        }
        setPopupOpen(open)
      }}
      onOpenChangeComplete={(open) => {
        if (open || !hoverOpened.current) return
        const previous = returnFocus.current
        returnFocus.current = null
        const active = document.activeElement
        // Only if focus is nowhere useful (body, or still in the closing menu).
        const stranded =
          !active ||
          active === document.body ||
          active.closest('[data-slot="dropdown-menu-content"]') !== null
        if (previous?.isConnected && stranded) {
          previous.focus({ preventScroll: true })
        }
      }}
    >
      <DropdownMenuTrigger
        render={<button type="button" className="rail-user" />}
        aria-label={`账户菜单：${name}`}
        // Hover opening is Base UI's own, so it never moves focus. Demo
        // timing: once the rail has expanded wait 45ms; from the collapsed
        // rail wait for the expand (70ms) to settle (220ms) first.
        openOnHover
        delay={
          expanded
            ? POPOVER_DELAY
            : RAIL_ENTER_DELAY + RAIL_SETTLE_TIME + POPOVER_DELAY
        }
        closeDelay={POPOVER_DELAY}
      >
        {account?.id !== undefined ? (
          <AvatarFrame
            level={profile?.vip_level}
            badge={frameBadge(account ?? undefined)}
            size="sm"
          >
            <PebbleAvatar
              id={account.id}
              pebble={profile?.pebble}
              className="size-8"
            />
          </AvatarFrame>
        ) : (
          <Avatar className="size-8">
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
        )}
        <span className="fade-item grid min-w-0 flex-1 leading-snug">
          <span className="truncate text-sm font-medium">{name}</span>
          {badges}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={10}
        className="rail-menu w-(--anchor-width) min-w-56"
        // Hover-opened: do not pull focus to the trigger on close; the
        // previous element is restored once the exit transition is done.
        finalFocus={() => !hoverOpened.current}
      >
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => {
              onNavigate()
              void navigate("/security")
            }}
          >
            <UserCogIcon />
            安全设置
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            variant="destructive"
            disabled={pending}
            onClick={() => void signOut()}
          >
            <LogOutIcon />
            {pending ? "正在退出…" : "退出登录"}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
