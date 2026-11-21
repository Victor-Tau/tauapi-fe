import { useState, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { PencilIcon } from "lucide-react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { updatePebble } from "@/api/user"
import {
  PEBBLE_EYE_NAMES,
  PEBBLE_PALETTE_NAMES,
  PEBBLE_TRAIT_NAMES,
  PebbleAvatar,
  pebbleSwatch,
  resolvePebble,
} from "@/components/pebble-avatar"
import { AvatarFrame } from "@/components/avatar-frame"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { queryKeys } from "@/lib/query"
import { cn } from "@/lib/utils"
import type { PebbleConfig, SelfProfile } from "@/types/api"
import { frameBadge } from "@/utils/vip"

/** Wraps the profile avatar in a button that opens the Pebble editor. */
export function PebbleEditor({
  user,
  children,
}: {
  user: SelfProfile
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        aria-label="自定义头像"
        title="自定义头像"
        className="group press relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setOpen(true)}
      >
        {children}
        <span className="absolute -right-0.5 -bottom-0.5 grid size-5 place-items-center rounded-full bg-background text-muted-foreground shadow-sm ring-1 ring-border transition-colors group-hover:text-foreground">
          <PencilIcon className="size-3" />
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[480px]">
          {/* Unmounts on close, so the draft resets each time. */}
          {open && <EditorForm user={user} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

function OptionRow({
  label,
  names,
  value,
  onChange,
  swatch,
}: {
  label: string
  names: readonly string[]
  value: number
  onChange: (value: number) => void
  swatch?: (index: number) => readonly [string, string]
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {names.map((name, index) => {
          const selected = index === value
          const colors = swatch?.(index)
          return (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(index)}
              className={cn(
                "press inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "bg-primary text-primary-foreground"
                  : "bg-(--control-bg) text-foreground hover:bg-(--control-hover)"
              )}
            >
              {colors && (
                <span
                  aria-hidden
                  className="size-3.5 rounded-full ring-1 ring-black/10"
                  style={{
                    background: `linear-gradient(135deg, ${colors[0]} 50%, ${colors[1]} 50%)`,
                  }}
                />
              )}
              {name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function sameLook(a: PebbleConfig, b: PebbleConfig) {
  return (
    a.trait === b.trait &&
    a.eyes === b.eyes &&
    a.palette === b.palette &&
    a.blush === b.blush
  )
}

function EditorForm({
  user,
  onDone,
}: {
  user: SelfProfile
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const initial = resolvePebble(user.id, user.pebble)
  const [draft, setDraft] = useState<PebbleConfig>(initial)
  const [pending, setPending] = useState<"save" | "reset" | null>(null)
  const set = (patch: Partial<PebbleConfig>) =>
    setDraft((prev) => ({ ...prev, ...patch }))

  const unchanged = Boolean(user.pebble) && sameLook(draft, initial)
  const isDefault = !user.pebble

  async function submit(value: PebbleConfig | null) {
    setPending(value ? "save" : "reset")
    try {
      await updatePebble(value)
      await queryClient.invalidateQueries({ queryKey: queryKeys.self })
      toast.success(value ? "头像已保存" : "已恢复默认头像")
      onDone()
    } catch (caught) {
      toast.error(errorMessage(caught))
    } finally {
      setPending(null)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>自定义头像</DialogTitle>
        <DialogDescription>
          挑选你的 Pebble，保存后在所有设备上同步显示。
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-5">
        <div className="flex justify-center">
          <AvatarFrame
            level={user.vip_level}
            badge={frameBadge(user)}
            size="lg"
          >
            <PebbleAvatar id={user.id} pebble={draft} className="size-24" />
          </AvatarFrame>
        </div>
        <OptionRow
          label="头顶配件"
          names={PEBBLE_TRAIT_NAMES}
          value={draft.trait}
          onChange={(trait) => set({ trait })}
        />
        <OptionRow
          label="眼神"
          names={PEBBLE_EYE_NAMES}
          value={draft.eyes}
          onChange={(eyes) => set({ eyes })}
        />
        <OptionRow
          label="配色"
          names={PEBBLE_PALETTE_NAMES}
          value={draft.palette}
          onChange={(palette) => set({ palette })}
          swatch={pebbleSwatch}
        />
        <label className="flex items-center gap-2 text-sm font-medium">
          <Checkbox
            checked={draft.blush}
            onCheckedChange={(checked) => set({ blush: checked === true })}
          />
          像素腮红
        </label>
      </div>
      <DialogFooter className="sm:justify-between">
        <Button
          variant="ghost"
          type="button"
          disabled={pending !== null || isDefault}
          onClick={() => void submit(null)}
          title={isDefault ? "当前已是默认头像" : undefined}
        >
          {pending === "reset" && <Spinner data-icon="inline-start" />}
          恢复默认
        </Button>
        <Button
          type="button"
          disabled={pending !== null || unchanged}
          onClick={() => void submit(draft)}
        >
          {pending === "save" && <Spinner data-icon="inline-start" />}
          保存
        </Button>
      </DialogFooter>
    </>
  )
}
