import { useSyncExternalStore } from "react"
import type { createBrowserRouter } from "react-router"

type DataRouter = ReturnType<typeof createBrowserRouter>

/**
 * React Router commits every navigation inside `startTransition`, so
 * `useLocation()` only changes once the next page's chunk has loaded *and*
 * the page has rendered. Chrome that must answer the click right away (the
 * rail indicator, the route skeleton) reads the router's own state through
 * this store instead: `useSyncExternalStore` updates are always synchronous,
 * so they paint in the same frame as the click.
 */
let router: DataRouter | null = null

export function bindRouter(instance: DataRouter): void {
  router = instance
}

function subscribe(listener: () => void): () => void {
  return router ? router.subscribe(() => listener()) : () => undefined
}

function getTargetPath(): string {
  if (!router) return window.location.pathname
  const { navigation, location } = router.state
  return navigation.location?.pathname ?? location.pathname
}

/** Pathname the user is heading to (or is on, once the navigation settles). */
export function useTargetPath(): string {
  return useSyncExternalStore(subscribe, getTargetPath)
}
