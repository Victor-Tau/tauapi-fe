import { ArrowLeftIcon, FileQuestionIcon } from "lucide-react"
import { Link, useNavigate } from "react-router"

import { AppBrand } from "@/components/app-brand"
import { ModeToggle } from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-4 md:px-10 md:py-[26px]">
        <AppBrand />
        <ModeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center p-6">
        <Empty className="max-w-md flex-none bg-card px-8 py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileQuestionIcon />
            </EmptyMedia>
            <span className="text-2xl leading-normal font-semibold tracking-[-0.3px] tabular-nums">
              404
            </span>
            <EmptyTitle>页面不存在</EmptyTitle>
            <EmptyDescription>
              地址可能输错了，或这个页面已经移动。
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="flex-row justify-center">
            <Button
              variant="outline"
              onClick={() => {
                // Opened directly (no history): fall back to the overview.
                if (window.history.length > 1) void navigate(-1)
                else void navigate("/dashboard", { replace: true })
              }}
            >
              <ArrowLeftIcon data-icon="inline-start" />
              返回上一页
            </Button>
            <Button
              nativeButton={false}
              render={<Link to="/dashboard" replace />}
            >
              回到总览
            </Button>
          </EmptyContent>
        </Empty>
      </main>
    </div>
  )
}
