import { useEffect, useRef, useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import type { useAuthTurnstile } from "@/hooks/use-auth-turnstile"

interface TurnstileApi {
  render(
    element: HTMLElement,
    options: {
      sitekey: string
      size: "compact" | "flexible"
      language: "zh-CN"
      "response-field": false
      callback: (token: string) => void
      "expired-callback": () => void
      "error-callback": () => boolean
      "timeout-callback": () => void
      "unsupported-callback": () => void
    }
  ): string | undefined
  remove(id: string): void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let scriptLoad: Promise<TurnstileApi> | undefined

function loadTurnstile() {
  if (scriptLoad) return scriptLoad
  if (window.turnstile) return Promise.resolve(window.turnstile)

  scriptLoad = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script")
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
    script.async = true

    const finish = (api?: TurnstileApi) => {
      window.clearTimeout(timeout)
      script.onload = null
      script.onerror = null
      if (api) {
        resolve(api)
      } else {
        script.remove()
        scriptLoad = undefined
        reject(new Error("Could not load Turnstile"))
      }
    }

    const timeout = window.setTimeout(() => finish(), 15_000)
    script.onload = () => finish(window.turnstile)
    script.onerror = () => finish()
    document.head.append(script)
  })
  return scriptLoad
}

function TurnstileWidget({
  siteKey,
  onToken,
}: {
  siteKey: string
  onToken: (value: string) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<"loading" | "rendered" | "error">(
    "loading"
  )

  useEffect(() => {
    const element = container.current
    if (!element) return
    let active = true
    let removeWidget: (() => void) | undefined

    function fail() {
      if (active) {
        onToken("")
        setStatus("error")
      }
    }

    loadTurnstile()
      .then((api) => {
        if (!active) return
        setStatus("rendered")
        const id = api.render(element, {
          sitekey: siteKey,
          size: element.clientWidth < 300 ? "compact" : "flexible",
          language: "zh-CN",
          "response-field": false,
          callback: (token) => {
            if (!active) return
            onToken(token)
            setStatus("rendered")
          },
          "expired-callback": fail,
          "error-callback": () => {
            fail()
            return true
          },
          "timeout-callback": fail,
          "unsupported-callback": fail,
        })
        if (id === undefined) {
          fail()
          return
        }
        removeWidget = () => api.remove(id)
      })
      .catch(fail)

    return () => {
      active = false
      onToken("")
      removeWidget?.()
    }
  }, [attempt, onToken, siteKey])

  return (
    <div className="flex min-w-0 flex-col items-start gap-2">
      <div ref={container} className="w-full [&_iframe]:max-w-full" />
      {status === "loading" && (
        <p role="status" className="text-sm text-muted-foreground">
          正在加载人机验证…
        </p>
      )}
      {status === "error" && (
        <>
          <p role="alert" className="text-sm text-destructive">
            人机验证遇到问题，请重试。
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setStatus("loading")
              setAttempt((previous) => previous + 1)
            }}
          >
            重试人机验证
          </Button>
        </>
      )}
    </div>
  )
}

export function AuthTurnstile({
  check,
  children,
}: {
  check: ReturnType<typeof useAuthTurnstile>
  children?: ReactNode
}) {
  const { site, siteKey, enabled, revision, updateToken } = check
  if (siteKey) {
    return (
      <div className="flex min-w-0 flex-col gap-2">
        {children}
        <TurnstileWidget
          key={`${siteKey}:${revision}`}
          siteKey={siteKey}
          onToken={updateToken}
        />
      </div>
    )
  }
  if (site.data && !enabled) return null
  if (site.isFetching) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        正在获取站点配置…
      </p>
    )
  }
  return (
    <div className="flex flex-col items-start gap-2">
      <p role="alert" className="text-sm text-destructive">
        {enabled
          ? "站点的人机验证配置不完整，请联系管理员。"
          : "无法获取站点配置，请重试。"}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void site.refetch()}
      >
        重新获取配置
      </Button>
    </div>
  )
}
