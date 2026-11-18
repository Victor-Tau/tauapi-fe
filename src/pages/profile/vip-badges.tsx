import type { ComponentProps } from "react"
import {
  AwardIcon,
  CrownIcon,
  GemIcon,
  GraduationCapIcon,
  MedalIcon,
  SproutIcon,
  TrophyIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { tierLabel, type VipTier } from "@/utils/vip"

/** One icon per VIP level, 0–5. */
const TIER_ICONS: LucideIcon[] = [
  SproutIcon,
  MedalIcon,
  AwardIcon,
  TrophyIcon,
  GemIcon,
  CrownIcon,
]

/**
 * One metal per level: neutral, bronze, silver, gold, platinum (teal),
 * diamond (violet). `text` colours icons and labels, `soft` is the badge
 * tint, `fill` the progress bar.
 */
const TIER_TONES = [
  {
    text: "text-muted-foreground",
    soft: "bg-nav-active",
    fill: "bg-muted-foreground",
  },
  {
    text: "text-[#9a5428] dark:text-[#e0a077]",
    soft: "bg-[#b4693a]/12",
    fill: "bg-[#b4693a]",
  },
  {
    text: "text-[#475569] dark:text-[#b4bfce]",
    soft: "bg-[#64748b]/12",
    fill: "bg-[#64748b]",
  },
  {
    text: "text-warning-text",
    soft: "bg-warning/14",
    fill: "bg-warning",
  },
  {
    text: "text-[#0e7490] dark:text-[#5fd0e0]",
    soft: "bg-[#0e9fb0]/12",
    fill: "bg-[#0e9fb0]",
  },
  {
    text: "text-[#6544d6] dark:text-[#b4a0ff]",
    soft: "bg-[#7c5cf0]/12",
    fill: "bg-[#7c5cf0]",
  },
] as const

export function tierTone(tier: VipTier) {
  return TIER_TONES[tier.level] ?? TIER_TONES[0]
}

/** The level's icon; extra props go to the svg. */
export function TierIcon({
  tier,
  ...props
}: { tier: VipTier } & ComponentProps<LucideIcon>) {
  const Icon = TIER_ICONS[tier.level] ?? SproutIcon
  return <Icon {...props} />
}

/** Special groups such as the student discount share one blue. */
export const GROUP_TONE = {
  text: "text-[#2f5de0] dark:text-[#8fb0ff]",
  soft: "bg-[#3b6ef5]/12",
} as const

/** Special (non-VIP) user groups with their own icon. */
const GROUP_ICONS: Record<string, LucideIcon> = {
  大学生优惠: GraduationCapIcon,
}

/** "VIP0 入门" with the tier's icon. */
export function VipBadge({
  tier,
  short = false,
  className,
  variant,
  ...props
}: { tier: VipTier; short?: boolean } & ComponentProps<typeof Badge>) {
  const tone = tierTone(tier)
  return (
    <Badge
      variant={variant}
      className={cn(tone.text, variant !== "outline" && tone.soft, className)}
      {...props}
    >
      <TierIcon tier={tier} data-icon="inline-start" />
      {short ? tierLabel(tier) : `${tierLabel(tier)} ${tier.name}`}
    </Badge>
  )
}

/** A special user group, e.g. the student discount with a mortarboard. */
export function GroupBadge({
  group,
  className,
  ...props
}: { group: string } & ComponentProps<typeof Badge>) {
  const Icon = GROUP_ICONS[group] ?? UsersIcon
  return (
    <Badge
      className={cn(GROUP_TONE.text, GROUP_TONE.soft, className)}
      {...props}
    >
      <Icon data-icon="inline-start" />
      {group}
    </Badge>
  )
}
