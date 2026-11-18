import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "react-router/dom"

import "./index.css"
import { apiClient } from "@/api/request"
import { ThemeProvider, useTheme } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { queryClient } from "@/lib/query"
import { router } from "@/router"

// Resume the session from the httpOnly refresh cookie. Failures surface through
// the auth snapshot ("error" status), which the sign-in page offers to retry.
void apiClient.restore().catch(() => undefined)

function ThemedToaster() {
  const { theme } = useTheme()
  // `dir` is explicit: sonner's default reads getComputedStyle(<html>) on
  // every render, forcing a full style/layout pass in the middle of a theme
  // switch (this component re-renders whenever the theme changes).
  return (
    <Toaster
      theme={theme}
      dir="ltr"
      position="top-center"
      richColors={false}
    />
  )
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider storageKey="api-console-theme">
        <TooltipProvider>
          <RouterProvider router={router} />
          <ThemedToaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>
)
