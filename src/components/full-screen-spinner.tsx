import { Skeleton } from "@/components/ui/skeleton"

/**
 * Session restore / route hydration placeholder. Inside the console it is a
 * skeleton of the shell (rail + header + cards) lit by the shared shimmer;
 * on the sign-in route it is the sign-in card's silhouette.
 */
export function FullScreenSpinner() {
  // Also rendered as the router's hydrate fallback, so read the URL directly.
  const signIn = window.location.pathname.startsWith("/login")

  return (
    <div className="flex min-h-svh bg-background" role="status">
      <span className="sr-only">加载中</span>
      {signIn ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="flex w-full max-w-sm flex-col gap-5 rounded-3xl bg-card p-6">
            <Skeleton className="h-7 w-32 rounded-lg bg-sk-strong" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-11 w-full rounded-xl bg-sk-strong" />
          </div>
        </div>
      ) : (
        <>
          <div className="hidden w-16 shrink-0 flex-col items-center gap-2 bg-sidebar pt-[13px] shadow-[inset_-1px_0_0_var(--border)] md:flex">
            <Skeleton className="size-[42px] rounded-[13px] bg-sk-strong" />
            <div className="mt-[23px] flex flex-col gap-5">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="size-8 rounded-lg" />
              ))}
            </div>
          </div>
          <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6 px-4 pt-6 md:px-10 md:pt-[26px]">
            <div className="flex flex-col gap-2.5 pb-1.5">
              <Skeleton className="h-7 w-52 rounded-lg bg-sk-strong" />
              <Skeleton className="h-4 w-36" />
            </div>
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-[104px] rounded-3xl bg-card" />
              ))}
            </div>
            <Skeleton className="h-72 rounded-3xl bg-card" />
          </div>
        </>
      )}
    </div>
  )
}
