import { useEffect } from "react"
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  useLocation,
} from "react-router"

import { FullScreenSpinner } from "@/components/full-screen-spinner"
import { useAuth } from "@/hooks/use-auth"
import { AppLayout } from "@/layouts/app-layout"
import { safeNextPath, useRouteTitle, type RouteHandle } from "@/lib/navigation"
import { bindRouter, useTargetPath } from "@/lib/route-target"

const APP_NAME = "MLTVRS"

function RootLayout() {
  const title = useRouteTitle()
  // Scroll as soon as a navigation starts, so the skeleton shows from the top.
  const pathname = useTargetPath()

  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME
  }, [title])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  return <Outlet />
}

function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  useEffect(() => {
    if (status === "authenticated") return preloadPages()
  }, [status])

  if (status === "loading") return <FullScreenSpinner />
  if (status !== "authenticated") {
    const next = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }
  return <Outlet />
}

function GuestOnly() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === "loading") return <FullScreenSpinner />
  if (status === "authenticated") {
    const next = safeNextPath(new URLSearchParams(location.search).get("next"))
    return <Navigate to={next ?? "/dashboard"} replace />
  }
  return <Outlet />
}

type PageModule = { default: React.ComponentType }

/** Every lazy page, so the shell can warm the chunks before they are needed. */
const pageLoaders: Array<() => Promise<PageModule>> = []

const page = (load: () => Promise<PageModule>) => {
  pageLoaders.push(load)
  return { lazy: async () => ({ Component: (await load()).default }) }
}

/**
 * Fetch all page chunks while the browser is idle, so a later navigation does
 * not wait on the network. The module cache makes repeat imports free.
 */
function preloadPages(): () => void {
  const run = () => {
    for (const load of pageLoaders) void load().catch(() => undefined)
  }
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(run, { timeout: 2000 })
    return () => window.cancelIdleCallback(id)
  }
  const id = window.setTimeout(run, 300)
  return () => window.clearTimeout(id)
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    hydrateFallbackElement: <FullScreenSpinner />,
    children: [
      {
        element: <GuestOnly />,
        children: [
          { path: "/login", ...page(() => import("@/pages/login")) },
          {
            path: "/register",
            handle: { title: "注册" } satisfies RouteHandle,
            ...page(() => import("@/pages/auth/register")),
          },
          {
            path: "/forgot-password",
            handle: { title: "忘记密码" } satisfies RouteHandle,
            ...page(() => import("@/pages/auth/forgot-password")),
          },
        ],
      },
      {
        // The backend's reset mail links here; it works signed in or out.
        path: "/user/reset",
        handle: { title: "重置密码" } satisfies RouteHandle,
        ...page(() => import("@/pages/auth/reset-password")),
      },
      { path: "/", element: <Navigate to="/dashboard" replace /> },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppLayout />,
            children: [
              {
                path: "/dashboard",
                handle: { title: "总览" } satisfies RouteHandle,
                ...page(() => import("@/pages/dashboard")),
              },
              {
                path: "/keys",
                handle: { title: "API 密钥" } satisfies RouteHandle,
                ...page(() => import("@/pages/keys")),
              },
              {
                path: "/models",
                handle: { title: "模型列表" } satisfies RouteHandle,
                ...page(() => import("@/pages/models")),
              },
              {
                path: "/usage",
                handle: { title: "用量记录" } satisfies RouteHandle,
                ...page(() => import("@/pages/usage")),
              },
              {
                path: "/wallet",
                handle: { title: "我的钱包" } satisfies RouteHandle,
                ...page(() => import("@/pages/wallet")),
              },
              {
                path: "/referral",
                handle: { title: "邀请返利" } satisfies RouteHandle,
                ...page(() => import("@/pages/referral")),
              },
              {
                path: "/profile",
                handle: { title: "个人资料" } satisfies RouteHandle,
                ...page(() => import("@/pages/profile")),
              },
              {
                path: "/security",
                handle: { title: "安全设置" } satisfies RouteHandle,
                ...page(() => import("@/pages/security")),
              },
            ],
          },
        ],
      },
      {
        path: "*",
        handle: { title: "页面未找到" } satisfies RouteHandle,
        ...page(() => import("@/pages/not-found")),
      },
    ],
  },
])

bindRouter(router)
