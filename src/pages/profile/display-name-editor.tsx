import { useState, type FormEvent } from "react"
import { PencilIcon } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { updateDisplayName } from "@/api/user"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"
import { queryKeys } from "@/lib/query"
import type { SelfProfile } from "@/types/api"

/** The display name with a pencil that opens a small editor below it. */
export function DisplayNameEditor({ user }: { user: SelfProfile }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex min-w-0 items-center gap-1">
      <h2 className="truncate font-heading text-base font-semibold">
        {user.display_name || user.username}
      </h2>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="修改显示名称"
              className="text-muted-foreground"
            />
          }
        >
          <PencilIcon />
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="w-80 max-w-[calc(100vw-1.5rem)] p-3"
        >
          {/* Unmounts on close, so the draft resets each time. */}
          {open && (
            <DisplayNameForm
              initial={user.display_name ?? ""}
              onDone={() => setOpen(false)}
            />
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

function DisplayNameForm({
  initial,
  onDone,
}: {
  initial: string
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(initial)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const trimmed = name.trim()
  const invalid = !trimmed
    ? "请输入显示名称"
    : [...trimmed].length > 20
      ? "最多 20 个字符"
      : null

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (invalid || trimmed === initial) return
    setPending(true)
    setError(null)
    try {
      await updateDisplayName(trimmed)
      await queryClient.invalidateQueries({ queryKey: queryKeys.self })
      toast.success("显示名称已更新")
      onDone()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      noValidate
      className="flex flex-col gap-3"
    >
      <Field data-invalid={Boolean(invalid || error) || undefined}>
        <FieldLabel htmlFor="display-name">显示名称</FieldLabel>
        <Input
          id="display-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
          autoComplete="nickname"
        />
        {(invalid || error) && <FieldError>{error ?? invalid}</FieldError>}
      </Field>
      <PopoverDescription className="text-xs">
        最多 20 个字符，登录仍使用用户名。
      </PopoverDescription>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" type="button" onClick={onDone}>
          取消
        </Button>
        <Button
          size="sm"
          type="submit"
          disabled={pending || Boolean(invalid) || trimmed === initial}
        >
          {pending && <Spinner data-icon="inline-start" />}
          保存
        </Button>
      </div>
    </form>
  )
}
