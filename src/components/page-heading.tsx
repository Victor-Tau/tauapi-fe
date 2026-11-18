import type { ReactNode } from "react"

import { ModeToggle } from "@/components/mode-toggle"

/**
 * Page header = the demo top bar: title + one-line description on the left;
 * page actions and the round theme switch on the right. Pages put at most one
 * primary action here.
 */
export function PageHeading({
  title,
  description,
  children,
}: {
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 pb-1.5 sm:flex-row sm:items-center sm:justify-between">
      {/* Optical inset: nudge the text in so it lines up with the content
          inside the rounded cards below, not with their outer edges. */}
      <div className="flex min-w-0 flex-col gap-1.5 pl-1.5">
        <h1 className="font-heading text-2xl leading-normal font-semibold tracking-[-0.3px] text-balance">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {children}
        {/* Phones/touch tablets have the theme switch in the top bar. */}
        <ModeToggle className="max-md:hidden touch:hidden" />
      </div>
    </div>
  )
}
