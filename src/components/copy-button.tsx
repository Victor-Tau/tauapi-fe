import { CheckIcon, CopyIcon } from "lucide-react"
import type { ComponentProps, ReactNode } from "react"
import { toast } from "sonner"

import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { useFlash } from "@/hooks/use-flash"
import { copyText } from "@/utils/clipboard"

/**
 * Copy button with in-place confirmation: the icon swaps to a check with a
 * spring pop for a moment, so the click is answered where the eye already is
 * (the toast is the secondary, accessible confirmation).
 */
export function CopyButton({
  text,
  what,
  failMessage = "无法访问剪贴板，请手动复制。",
  onFail,
  children,
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, "onClick" | "children"> & {
  /** Text to copy, or a function resolving it (e.g. fetching a secret). */
  text: string | (() => Promise<string> | string)
  /** Noun used in the toast: “已复制{what}”. */
  what: string
  failMessage?: string
  /** Called instead of the error toast when the browser refuses. */
  onFail?: (text: string) => void
  /** Optional label after the icon. */
  children?: ReactNode
}) {
  const [copied, flash] = useFlash()

  async function copy() {
    const value = typeof text === "function" ? await text() : text
    if (await copyText(value)) {
      flash()
      toast.success(`已复制${what}`)
    } else if (onFail) onFail(value)
    else toast.error(failMessage)
  }

  const Icon = copied ? CheckIcon : CopyIcon
  return (
    <Button
      {...props}
      data-copied={copied || undefined}
      className={cn(className, copied && "text-foreground!")}
      onClick={() => {
        void copy().catch(() => undefined)
      }}
    >
      <Icon
        key={copied ? "done" : "idle"}
        data-icon={children ? "inline-start" : undefined}
        className={cn(
          copied &&
            "animate-[icon-confirm-pop_400ms_var(--ease-spring-pop)] motion-reduce:animate-none"
        )}
        aria-hidden="true"
      />
      {children}
    </Button>
  )
}
