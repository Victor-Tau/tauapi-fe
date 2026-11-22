import { useCallback, useRef, useState } from "react"

import { ApiError } from "@/api/errors"
import { useSiteStatus } from "@/hooks/use-queries"

export function useAuthTurnstile() {
  const site = useSiteStatus({ refetchOnMount: "always" })
  const enabled = site.data?.turnstile_check === true
  const siteKey = enabled ? site.data?.turnstile_site_key : undefined
  const token = useRef<{ siteKey: string; value: string } | null>(null)
  const [verifiedKey, setVerifiedKey] = useState<string>()
  const [revision, setRevision] = useState(0)

  const updateToken = useCallback(
    (value: string) => {
      token.current = siteKey && value ? { siteKey, value } : null
      setVerifiedKey(token.current?.siteKey)
    },
    [siteKey]
  )

  // A token can authorize one request, even when the server rejects the action.
  async function withToken<T>(request: (value?: string) => Promise<T>) {
    const current = token.current
    if (!site.data || (enabled && (!siteKey || current?.siteKey !== siteKey))) {
      throw new ApiError("请先完成人机验证。")
    }
    const value = enabled ? current?.value : undefined
    updateToken("")
    try {
      return await request(value)
    } catch (error) {
      if (error instanceof ApiError && error.key?.startsWith("Turnstile ")) {
        void site.refetch()
      }
      throw error
    } finally {
      if (value) setRevision((previous) => previous + 1)
    }
  }

  return {
    site,
    siteKey,
    enabled,
    ready: !!site.data && (!enabled || (!!siteKey && verifiedKey === siteKey)),
    revision,
    updateToken,
    withToken,
  }
}
