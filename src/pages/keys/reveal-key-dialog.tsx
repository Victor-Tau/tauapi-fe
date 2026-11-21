import { CopyButton } from "@/components/copy-button"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

export interface RevealedKey {
  name: string
  key: string
}

export function RevealKeyDialog({
  secret,
  onClose,
}: {
  secret: RevealedKey | null
  onClose: () => void
}) {
  return (
    <Dialog
      open={secret !== null}
      onOpenChange={(open) => {
        // The full key is dropped from memory as soon as the dialog closes.
        if (!open) onClose()
      }}
    >
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="truncate">{secret?.name}</DialogTitle>
          <DialogDescription>
            完整密钥仅在此处显示，请妥善保管。
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="revealed-key">API 密钥</FieldLabel>
          <Textarea
            id="revealed-key"
            readOnly
            dir="ltr"
            spellCheck={false}
            value={secret?.key ?? ""}
            onFocus={(event) => event.currentTarget.select()}
            className="min-h-20 resize-none font-mono text-sm break-all"
          />
        </Field>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>关闭</DialogClose>
          <CopyButton
            text={secret?.key ?? ""}
            what="密钥"
            failMessage="无法访问剪贴板，请手动复制密钥。"
          >
            复制密钥
          </CopyButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
