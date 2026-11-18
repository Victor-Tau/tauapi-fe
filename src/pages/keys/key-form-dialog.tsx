import { useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { CircleAlertIcon } from "lucide-react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { createKey, updateKey } from "@/api/keys"
import { errorMessage } from "@/api/errors"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { useSelfGroups, useUserModels } from "@/hooks/use-queries"
import { keyFormSchema } from "@/lib/key-form-schema"
import { queryKeys } from "@/lib/query"
import type { ModelApiToken } from "@/types/api"
import {
  createKeyPayload,
  getKeyFormDefaults,
  updateKeyPayload,
  type KeyFormValues,
} from "@/utils/key-form"

const EXPIRATION_ITEMS = [
  { label: "永久有效", value: "never" },
  { label: "自定义时间", value: "custom" },
] as const

/** `token` undefined means "create". */
export function KeyFormDialog({
  open,
  token,
  onOpenChange,
  onOpenChangeComplete,
}: {
  open: boolean
  token?: ModelApiToken
  onOpenChange: (open: boolean) => void
  onOpenChangeComplete?: (open: boolean) => void
}) {
  return (
    // A form dialog never closes on a stray click outside; Esc, Cancel and
    // the close button still do.
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={onOpenChangeComplete}
      disablePointerDismissal
    >
      <DialogContent className="grid max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{token ? "编辑 API 密钥" : "创建 API 密钥"}</DialogTitle>
          <DialogDescription>配置名称、有效期和访问权限。</DialogDescription>
        </DialogHeader>
        {/* Popup content unmounts when closed, so every open starts fresh. */}
        <KeyForm
          key={token?.id ?? "new"}
          token={token}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function KeyForm({
  token,
  onDone,
}: {
  token?: ModelApiToken
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const groups = useSelfGroups()
  const models = useUserModels()

  const groupNames = useMemo(() => Object.keys(groups.data ?? {}), [groups.data])
  const groupItems = useMemo(
    () => [
      {
        label: groups.isPending ? "正在加载分组…" : "选择服务器分组",
        value: null,
      },
      ...groupNames.map((name) => {
        const desc = groups.data?.[name]?.desc
        return { label: desc ? `${name} · ${desc}` : name, value: name }
      }),
    ],
    [groupNames, groups.data, groups.isPending]
  )
  const schema = useMemo(() => keyFormSchema(groupNames), [groupNames])

  const form = useForm<KeyFormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: getKeyFormDefaults(token),
  })
  const [expiration, unlimited, restrictModels] = useWatch({
    control: form.control,
    name: ["expiration", "unlimited", "restrictModels"],
  })

  const save = useMutation({
    mutationFn: (values: KeyFormValues) =>
      token
        ? updateKey(updateKeyPayload(values, token))
        : createKey(createKeyPayload(values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.keysAll })
      toast.success(token ? "密钥已更新" : "密钥已创建")
      onDone()
    },
  })

  const groupsUnavailable = groups.isSuccess && groupNames.length === 0
  const canSubmit = groups.isSuccess && groupNames.length > 0 && !save.isPending

  return (
    <>
      <form
        id="key-form"
        noValidate
        className="-mx-5 overflow-y-auto px-5 py-1"
        onSubmit={form.handleSubmit((values) => save.mutate(values))}
      >
        <FieldGroup>
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                <FieldLabel htmlFor="key-name">密钥名称</FieldLabel>
                <Input
                  {...field}
                  id="key-name"
                  maxLength={50}
                  placeholder="例如：生产环境服务"
                  autoComplete="off"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <Controller
              name="group"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor="key-group">访问分组</FieldLabel>
                  <Select
                    items={groupItems}
                    value={field.value || null}
                    onValueChange={(value) => {
                      field.onChange(value ?? "")
                      field.onBlur()
                    }}
                    disabled={!groups.isSuccess || groupsUnavailable}
                  >
                    <SelectTrigger
                      id="key-group"
                      ref={field.ref}
                      className="w-full"
                      aria-invalid={fieldState.invalid}
                      onBlur={field.onBlur}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {groupItems.map((item) => (
                          <SelectItem key={item.value ?? ""} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {groups.isError ? (
                    <FieldError>
                      无法读取可用分组：{errorMessage(groups.error)}
                    </FieldError>
                  ) : groupsUnavailable ? (
                    <FieldError>服务器暂未返回可用分组</FieldError>
                  ) : (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              name="expiration"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="key-expiration">有效期</FieldLabel>
                  <Select
                    items={EXPIRATION_ITEMS}
                    value={field.value}
                    onValueChange={(value) => {
                      if (value) field.onChange(value)
                    }}
                  >
                    <SelectTrigger
                      id="key-expiration"
                      ref={field.ref}
                      className="w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {EXPIRATION_ITEMS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
          </div>

          {expiration === "custom" && (
            <Controller
              name="expiresAt"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor="key-expires-at">到期时间</FieldLabel>
                  <Input
                    {...field}
                    id="key-expires-at"
                    type="datetime-local"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          )}

          <Controller
            name="unlimited"
            control={form.control}
            render={({ field }) => (
              <Field orientation="horizontal">
                <Checkbox
                  id="key-unlimited"
                  ref={field.ref}
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked)}
                />
                <FieldLabel htmlFor="key-unlimited" className="font-normal">
                  不限制剩余额度
                </FieldLabel>
              </Field>
            )}
          />

          {!unlimited && (
            <Controller
              name="remainingQuota"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor="key-quota">剩余额度（quota）</FieldLabel>
                  <Input
                    {...field}
                    id="key-quota"
                    inputMode="numeric"
                    placeholder="请输入非负整数"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          )}

          <Controller
            name="restrictModels"
            control={form.control}
            render={({ field }) => (
              <Field orientation="horizontal">
                <Checkbox
                  id="key-restrict-models"
                  ref={field.ref}
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked)}
                />
                <FieldLabel
                  htmlFor="key-restrict-models"
                  className="font-normal"
                >
                  限制可调用的模型
                </FieldLabel>
              </Field>
            )}
          />

          {restrictModels && (
            <Controller
              name="models"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor="key-models">允许的模型</FieldLabel>
                  <ModelPicker
                    id="key-models"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    options={models.data ?? []}
                    invalid={fieldState.invalid}
                  />
                  {fieldState.error ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : (
                    <FieldDescription>
                      {models.isError
                        ? "无法读取模型列表，可直接输入模型名称后回车添加。"
                        : "从列表中选择，或输入模型名称后回车添加。"}
                    </FieldDescription>
                  )}
                </Field>
              )}
            />
          )}

          <Controller
            name="allowIps"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                <FieldLabel htmlFor="key-ips">IP 白名单（可选）</FieldLabel>
                <Textarea
                  {...field}
                  id="key-ips"
                  dir="ltr"
                  spellCheck={false}
                  placeholder="每行一个 IPv4、IPv6 或 CIDR 地址"
                  className="min-h-20 font-mono"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          {save.isError && (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>{token ? "保存失败" : "创建失败"}</AlertTitle>
              <AlertDescription>{errorMessage(save.error)}</AlertDescription>
            </Alert>
          )}
        </FieldGroup>
      </form>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>取消</DialogClose>
        <Button type="submit" form="key-form" disabled={!canSubmit}>
          {save.isPending && <Spinner data-icon="inline-start" />}
          {save.isPending ? "正在保存…" : token ? "保存更改" : "创建密钥"}
        </Button>
      </DialogFooter>
    </>
  )
}

function splitModels(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((model) => model.trim())
        .filter(Boolean)
    ),
  ]
}

/**
 * Multi-select of model names. The form keeps the comma-separated string the
 * payload helpers expect; text typed here that is not in the server list is
 * offered as an extra option so any model name can be added.
 */
function ModelPicker({
  id,
  value,
  onChange,
  onBlur,
  options,
  invalid,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  options: string[]
  invalid: boolean
}) {
  const anchor = useComboboxAnchor()
  const [input, setInput] = useState("")
  const selected = useMemo(() => splitModels(value), [value])
  const typed = input.trim()

  const items = useMemo(() => {
    const all = [...new Set([...options, ...selected])]
    if (typed && !all.includes(typed)) all.push(typed)
    return all
  }, [options, selected, typed])

  return (
    <Combobox
      multiple
      autoHighlight
      items={items}
      value={selected}
      onValueChange={(next: string[]) => onChange(next.join(","))}
      inputValue={input}
      onInputValueChange={setInput}
    >
      <ComboboxChips ref={anchor}>
        <ComboboxValue>
          {(values: string[]) => (
            <>
              {values.map((model) => (
                <ComboboxChip key={model}>{model}</ComboboxChip>
              ))}
              <ComboboxChipsInput
                id={id}
                dir="ltr"
                placeholder={values.length ? "" : "选择或输入模型名称"}
                aria-invalid={invalid || undefined}
                onBlur={onBlur}
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>没有匹配的模型</ComboboxEmpty>
        <ComboboxList>
          {(model: string) => (
            <ComboboxItem key={model} value={model}>
              {model === typed && !options.includes(model) && !selected.includes(model)
                ? `添加“${model}”`
                : model}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
