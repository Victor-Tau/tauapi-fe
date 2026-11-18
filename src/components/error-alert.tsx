import { CircleAlertIcon, RotateCwIcon } from "lucide-react"

import { errorMessage } from "@/api/errors"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export function ErrorAlert({
  error,
  title = "加载失败",
  onRetry,
  retrying = false,
}: {
  error: unknown
  title?: string
  onRetry?: () => void
  retrying?: boolean
}) {
  return (
    <Alert variant="destructive">
      <CircleAlertIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        {typeof error === "string" ? error : errorMessage(error)}
      </AlertDescription>
      {onRetry && (
        <AlertAction>
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={retrying}
          >
            <RotateCwIcon
              data-icon="inline-start"
              className={retrying ? "animate-spin" : undefined}
            />
            重试
          </Button>
        </AlertAction>
      )}
    </Alert>
  )
}
