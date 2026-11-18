import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// Edited after generation: soft background + deep text for every status
// (one business meaning → one variant across the app). Colour is reserved for
// real status: success / warning / danger; everything else is neutral.
const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm px-2.5 text-xs font-medium whitespace-nowrap tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-ring has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-nav-active text-muted-foreground",
        secondary: "bg-nav-active text-muted-foreground",
        neutral: "bg-nav-active text-muted-foreground",
        outline:
          "text-muted-foreground ring-1 ring-divider ring-inset",
        success: "bg-success/12 text-success-text",
        warning: "bg-warning/14 text-warning-text",
        destructive: "bg-destructive/10 text-destructive",
        danger: "bg-destructive/10 text-destructive",
        ghost: "text-muted-foreground hover:bg-nav-hover",
        link: "text-foreground underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
