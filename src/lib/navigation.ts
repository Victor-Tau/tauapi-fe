import { useMatches } from "react-router"

export interface RouteHandle {
  title?: string
}

/** Title of the deepest matched route that declares one. */
export function useRouteTitle(): string | undefined {
  const matches = useMatches()
  for (let index = matches.length - 1; index >= 0; index--) {
    const title = (matches[index]?.handle as RouteHandle | undefined)?.title
    if (title) return title
  }
  return undefined
}

/** Only same-origin paths: a single leading "/" not followed by "/" or "\". */
export function safeNextPath(next: string | null): string | null {
  if (!next || !/^\/(?![/\\])/.test(next)) return null
  return next
}
