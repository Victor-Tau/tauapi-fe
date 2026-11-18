import type { ReactNode } from "react"

import { errorMessage } from "@/api/errors"
import { AppBrand } from "@/components/app-brand"
import { ConnectionIndicator } from "@/components/connection-status"
import {
  LoginMascots,
  type LoginMascotsProps,
} from "@/components/login-mascots"
import { ModeToggle } from "@/components/mode-toggle"
import { useSiteStatus } from "@/hooks/use-queries"

// Underlined fields and pill buttons, after the "Welcome back!" mock-up.
export const AUTH_LABEL = "text-[15px] font-medium"
export const AUTH_INPUT =
  "h-10 rounded-none border-b border-foreground/25 bg-transparent px-0 transition-[border-color] hover:border-foreground/45 focus-visible:border-foreground focus-visible:ring-0 aria-invalid:border-destructive aria-invalid:ring-0"
export const AUTH_INPUT_GROUP =
  "h-10 rounded-none border-b border-foreground/25 bg-transparent transition-[border-color] hover:border-foreground/45 has-[[data-slot=input-group-control]:focus-visible]:border-foreground has-[[data-slot=input-group-control]:focus-visible]:ring-0 has-[[data-slot][aria-invalid=true]]:border-destructive has-[[data-slot][aria-invalid=true]]:ring-0"
// Grows the clickable area of small buttons and links without changing looks.
export const AUTH_HIT = "relative after:absolute after:-inset-2"
export const AUTH_BUTTON = "h-12 rounded-full text-[15px]"
export const AUTH_LINK =
  "relative font-medium after:absolute after:-inset-x-1 after:-inset-y-2 text-foreground underline-offset-4 hover:underline"

/** Split screen for the signed-out pages: mascots left, form right. */
export function AuthShell({
  mascots,
  title,
  description,
  footer,
  children,
}: {
  mascots?: LoginMascotsProps
  title: ReactNode
  /** Omitted on login/register: no line under the title. */
  description?: ReactNode
  /** Below the form, e.g. "Don't have an account? Sign up". */
  footer?: ReactNode
  children: ReactNode
}) {
  const site = useSiteStatus()
  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-2">
      <aside className="hidden flex-col overflow-hidden bg-muted/50 lg:flex">
        <header className="flex items-center px-10 py-[26px]">
          <AppBrand />
        </header>
        <div className="flex flex-1 items-center justify-center px-10">
          <LoginMascots {...mascots} />
        </div>
        <footer className="px-10 py-6 text-xs text-muted-foreground tabular-nums">
          © {new Date().getFullYear()} MLTVRS
        </footer>
      </aside>
      <div className="flex min-h-svh flex-col">
        <header className="flex items-center justify-between px-4 py-4 md:px-10 md:py-[26px] lg:justify-end">
          <div className="lg:hidden">
            <AppBrand />
          </div>
          <ModeToggle />
        </header>
        <main className="flex flex-1 items-center justify-center p-6 md:p-10">
          <div className="auth-swap flex w-full max-w-sm flex-col gap-10">
            <header className="flex flex-col items-center gap-3 text-center">
              <h1 className="text-4xl font-bold tracking-[-0.8px]">{title}</h1>
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </header>
            <div>{children}</div>
            {site.isError && (
              <p className="text-center text-xs text-destructive">
                {errorMessage(site.error)}
              </p>
            )}
          </div>
        </main>
        <footer className="flex flex-col items-center gap-6 px-4 py-6 text-xs text-muted-foreground tabular-nums md:px-10">
          {footer && <p className="auth-swap-footer text-sm">{footer}</p>}
          <span className="lg:invisible">
            © {new Date().getFullYear()} MLTVRS
          </span>
        </footer>
      </div>
      <ConnectionIndicator />
    </div>
  )
}
