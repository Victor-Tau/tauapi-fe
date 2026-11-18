import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  CircleAlertIcon,
  CircleCheckIcon,
  CirclePauseIcon,
  ClockIcon,
  CopyIcon,
  EllipsisIcon,
  EyeIcon,
  KeyRoundIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  PowerOffIcon,
  RotateCwIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react"
import { useSearchParams } from "react-router"
import { toast } from "sonner"

import {
  deleteKey,
  getKey,
  revealKey,
  setKeyStatus,
  updateKey,
} from "@/api/keys"
import { ApiError, errorMessage } from "@/api/errors"
import { DataPagination, pageCountOf } from "@/components/data-pagination"
import { ErrorAlert } from "@/components/error-alert"
import { PageHeading } from "@/components/page-heading"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  KEYS_PAGE_SIZE,
  useKeys,
  useSelfGroups,
  useSiteStatus,
} from "@/hooks/use-queries"
import { queryKeys } from "@/lib/query"
import type { ModelApiToken, UserGroups } from "@/types/api"
import { copyText } from "@/utils/clipboard"
import { formatNumber, formatQuota, formatUnixSeconds } from "@/utils/format"
import { canEditKey, keyStatus, regroupKeyPayload } from "@/utils/key-form"

import { DeleteKeyDialog } from "./delete-key-dialog"
import { KeyFormDialog } from "./key-form-dialog"
import { RevealKeyDialog, type RevealedKey } from "./reveal-key-dialog"

// One business meaning → one badge variant; an icon backs up the colour.
const STATUS_STYLE: Record<
  ReturnType<typeof keyStatus>["tone"],
  {
    variant: React.ComponentProps<typeof Badge>["variant"]
    icon: typeof CircleCheckIcon
  }
> = {
  lime: { variant: "success", icon: CircleCheckIcon },
  gray: { variant: "neutral", icon: CirclePauseIcon },
  orange: { variant: "warning", icon: ClockIcon },
  rose: { variant: "danger", icon: CircleAlertIcon },
}

/** Dialog state that survives the close animation, then is cleared. */
interface Closable<T> {
  value: T
  open: boolean
}

export default function KeysPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [editing, setEditing] = useState<Closable<ModelApiToken> | null>(null)
  const [deleting, setDeleting] = useState<Closable<ModelApiToken> | null>(null)
  const [secret, setSecret] = useState<RevealedKey | null>(null)

  const keys = useKeys(page, KEYS_PAGE_SIZE)
  const site = useSiteStatus()
  const groups = useSelfGroups()
  const items = keys.data?.items ?? []
  const total = keys.data?.total ?? 0
  const pageCount = pageCountOf(total, keys.data?.page_size || KEYS_PAGE_SIZE)

  const createOpen = searchParams.get("create") === "1"
  const formOpen = createOpen || editing?.open === true

  function openCreate() {
    setSearchParams(
      (params) => {
        params.set("create", "1")
        return params
      },
      { replace: true }
    )
  }

  function closeForm() {
    if (createOpen) {
      setSearchParams(
        (params) => {
          params.delete("create")
          return params
        },
        { replace: true }
      )
    }
    setEditing((current) => current && { ...current, open: false })
  }

  const invalidateKeys = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.keysAll })

  const toggle = useMutation({
    mutationFn: (token: ModelApiToken) =>
      setKeyStatus(token.id, token.status === 1 ? 2 : 1),
    onMutate: (token) => setBusyId(token.id),
    onSuccess: (_, token) => {
      toast.success(token.status === 1 ? "密钥已停用" : "密钥已启用")
      return invalidateKeys()
    },
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: () => setBusyId(null),
  })

  const remove = useMutation({
    mutationFn: (token: ModelApiToken) => deleteKey(token.id),
    onMutate: (token) => setBusyId(token.id),
    onSuccess: (_, token) => {
      toast.success(`已删除密钥“${token.name}”`)
      setDeleting((current) => current && { ...current, open: false })
      // The last row of a later page is gone: step back instead of showing an empty page.
      if (items.length === 1 && page > 1) setPage(page - 1)
      return invalidateKeys()
    },
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: () => setBusyId(null),
  })

  // Re-read the key so the PUT carries the server's current settings, not
  // whatever this page cached.
  const regroup = useMutation({
    mutationFn: async ({
      token,
      group,
    }: {
      token: ModelApiToken
      group: string
    }) => {
      const full = await getKey(token.id)
      if (!canEditKey(full)) {
        throw new ApiError(
          "服务器返回的密钥配置不完整，为避免覆盖现有权限，无法修改分组。",
          200,
          "INCOMPLETE_KEY"
        )
      }
      await updateKey(regroupKeyPayload(full, group))
    },
    onMutate: ({ token }) => setBusyId(token.id),
    onSuccess: (_, { token, group }) => {
      toast.success(`“${token.name}”已切换到 ${group} 分组`)
      return invalidateKeys()
    },
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: () => setBusyId(null),
  })

  async function copyKey(token: ModelApiToken) {
    setBusyId(token.id)
    try {
      const key = await revealKey(token.id)
      if (await copyText(key)) toast.success("已复制密钥")
      // The browser can refuse after the network round trip; let the user copy by hand.
      else setSecret({ name: token.name, key })
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  // Reveal and edit read sensitive/fresh data directly instead of caching it.
  async function reveal(token: ModelApiToken) {
    setBusyId(token.id)
    try {
      setSecret({ name: token.name, key: await revealKey(token.id) })
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  async function edit(token: ModelApiToken) {
    setBusyId(token.id)
    try {
      const full = await getKey(token.id)
      if (!canEditKey(full)) {
        toast.error(
          "服务器返回的密钥配置不完整，为避免覆盖现有权限，无法编辑。"
        )
        return
      }
      setEditing({ value: full, open: true })
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="API 密钥">
        <Button onClick={openCreate}>
          <PlusIcon data-icon="inline-start" />
          创建 API 密钥
        </Button>
      </PageHeading>

      {keys.isError && (
        <ErrorAlert
          error={keys.error}
          onRetry={() => void keys.refetch()}
          retrying={keys.isFetching}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>你的密钥</CardTitle>
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              disabled={keys.isFetching}
              onClick={() => void keys.refetch()}
            >
              <RotateCwIcon
                data-icon="inline-start"
                className={keys.isFetching ? "animate-spin" : undefined}
              />
              {keys.isFetching ? "更新中…" : "刷新列表"}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {keys.isPending ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : items.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>密钥</TableHead>
                  <TableHead>分组</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">剩余额度</TableHead>
                  <TableHead className="text-right">最近使用</TableHead>
                  <TableHead className="w-16 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((token) => {
                  const status = keyStatus(token.status)
                  const style = STATUS_STYLE[status.tone]
                  const busy = busyId === token.id
                  return (
                    <TableRow key={token.id} aria-busy={busy || undefined}>
                      <TableCell className="font-medium">
                        {token.name}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-sm">
                            {token.key ?? "sk-••••••••"}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground"
                            disabled={busy}
                            onClick={() => void copyKey(token)}
                            aria-label={`复制密钥 ${token.name}`}
                          >
                            <CopyIcon />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <GroupSelect
                          token={token}
                          groups={groups.data}
                          disabled={busy || !canEditKey(token)}
                          onChange={(group) => regroup.mutate({ token, group })}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant={style.variant}>
                          <style.icon data-icon="inline-start" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="tabular-nums">
                          {token.unlimited_quota === undefined
                            ? "未提供"
                            : token.unlimited_quota
                              ? "无限额"
                              : formatQuota(token.remain_quota, site.data)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {token.accessed_time === 0
                          ? "尚未使用"
                          : formatUnixSeconds(token.accessed_time)}
                      </TableCell>
                      <TableCell className="text-right">
                        <KeyActions
                          token={token}
                          busy={busy}
                          onReveal={() => void reveal(token)}
                          onEdit={() => void edit(token)}
                          onToggle={() => toggle.mutate(token)}
                          onDelete={() =>
                            setDeleting({ value: token, open: true })
                          }
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : keys.isSuccess ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <KeyRoundIcon />
                </EmptyMedia>
                <EmptyTitle>
                  {page > 1 ? "这一页暂无密钥" : "还没有 API 密钥"}
                </EmptyTitle>
                <EmptyDescription>
                  {page > 1
                    ? "返回上一页，继续查看你的密钥。"
                    : "创建密钥后，即可在应用中调用模型。"}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                {page > 1 ? (
                  <Button variant="outline" onClick={() => setPage(page - 1)}>
                    返回上一页
                  </Button>
                ) : (
                  // The header already holds the page's single primary action.
                  <Button variant="outline" onClick={openCreate}>
                    <PlusIcon data-icon="inline-start" />
                    创建第一个密钥
                  </Button>
                )}
              </EmptyContent>
            </Empty>
          ) : null}
        </CardContent>
        {total > 0 && (
          <CardFooter>
            <DataPagination
              summary={`共 ${formatNumber(total)} 个密钥`}
              page={page}
              pageCount={pageCount}
              onPageChange={setPage}
              disabled={keys.isFetching}
            />
          </CardFooter>
        )}
      </Card>

      <Alert>
        <ShieldCheckIcon />
        <AlertTitle>安全建议</AlertTitle>
        <AlertDescription>
          请将 API
          密钥保存在服务端环境中，不要放入公开网页或公开仓库。为不同应用创建独立密钥，便于管理额度与访问范围。
        </AlertDescription>
      </Alert>

      <KeyFormDialog
        open={formOpen}
        token={createOpen ? undefined : editing?.value}
        onOpenChange={(open) => {
          if (!open) closeForm()
        }}
        onOpenChangeComplete={(open) => {
          if (!open) setEditing(null)
        }}
      />
      <RevealKeyDialog secret={secret} onClose={() => setSecret(null)} />
      <DeleteKeyDialog
        token={deleting?.value ?? null}
        open={deleting?.open === true}
        pending={remove.isPending}
        onOpenChange={(open) =>
          setDeleting((current) => current && { ...current, open })
        }
        onOpenChangeComplete={(open) => {
          if (!open) setDeleting(null)
        }}
        onConfirm={() => deleting && remove.mutate(deleting.value)}
      />
    </div>
  )
}

/**
 * Inline group switch. The key's current group stays listed even if the
 * server no longer offers it, so the trigger never shows a blank value.
 */
function GroupSelect({
  token,
  groups,
  disabled,
  onChange,
}: {
  token: ModelApiToken
  groups: UserGroups | undefined
  disabled: boolean
  onChange: (group: string) => void
}) {
  const current = token.group || null
  const names = Object.keys(groups ?? {})
  if (current && !names.includes(current)) names.unshift(current)
  const items = names.map((name) => ({ label: name, value: name }))

  return (
    <Select
      items={items}
      value={current}
      onValueChange={(value) => {
        if (value && value !== current) onChange(value)
      }}
      disabled={disabled || names.length === 0}
    >
      <SelectTrigger
        size="sm"
        className="w-36"
        aria-label={`切换分组：${token.name}`}
      >
        <SelectValue placeholder="未设置分组" />
      </SelectTrigger>
      <SelectContent className="w-auto">
        <SelectGroup>
          {names.map((name) => {
            const desc = groups?.[name]?.desc
            return (
              <SelectItem key={name} value={name}>
                {desc ? `${name} · ${desc}` : name}
              </SelectItem>
            )
          })}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

/**
 * Row actions all sit behind "more": view/edit first, then the status
 * switch, with the destructive delete last.
 */
function KeyActions({
  token,
  busy,
  onReveal,
  onEdit,
  onToggle,
  onDelete,
}: {
  token: ModelApiToken
  busy: boolean
  onReveal: () => void
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const canToggle = token.status === 1 || token.status === 2

  return (
    <div className="flex items-center justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={busy}
              aria-label={`更多操作：${token.name}`}
            />
          }
        >
          {busy ? <Spinner /> : <EllipsisIcon />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-40">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={onReveal}>
              <EyeIcon />
              查看密钥
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canEditKey(token)} onClick={onEdit}>
              <PencilIcon />
              编辑
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem disabled={!canToggle} onClick={onToggle}>
              {token.status === 1 ? <PowerOffIcon /> : <PowerIcon />}
              {token.status === 1 ? "停用" : "启用"}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2Icon />
              删除
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
