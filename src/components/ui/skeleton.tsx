import { cn } from "cn"

// Edited after generation: static neutral block; the shimmer is a single
// viewport-anchored sweep shared by all blocks (see styles/motion.css).
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }
