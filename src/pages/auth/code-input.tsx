import {
  useRef,
  type ClipboardEvent,
  type ComponentProps,
  type FocusEvent,
  type KeyboardEvent,
} from "react"

import { cn } from "@/lib/utils"

const LENGTH = 6

const clean = (text: string) => text.toUpperCase().replace(/[^A-Z0-9]/g, "")

/**
 * Six boxes for a fixed-length alphanumeric code, one input per box so each
 * character can be edited on its own. Typed letters are upper-cased and
 * anything outside A–Z/0–9 is dropped; pasting fills from the current box.
 *
 * `value` keeps a space for an empty box (trailing spaces trimmed), so a
 * complete code has six characters and no spaces.
 */
export function CodeInput({
  value,
  onChange,
  className,
  disabled,
  id,
  autoComplete,
  onBlur,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: Pick<
  ComponentProps<"input">,
  | "className"
  | "disabled"
  | "id"
  | "autoComplete"
  | "aria-invalid"
  | "aria-describedby"
> & {
  value: string
  onChange: (value: string) => void
  /** Focus left all six boxes. */
  onBlur?: () => void
}) {
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const slots = Array.from({ length: LENGTH }, (_, i) => value[i]?.trim() ?? "")
  const invalid = ariaInvalid === true || ariaInvalid === "true"

  function focusBox(i: number) {
    const box = inputs.current[Math.max(0, Math.min(LENGTH - 1, i))]
    box?.focus()
    box?.select()
  }

  function commit(next: string[]) {
    onChange(
      next
        .map((c) => c || " ")
        .join("")
        .trimEnd()
    )
  }

  /** Writes characters from box `start` on and moves focus past them. */
  function fill(start: number, chars: string) {
    const next = [...slots]
    const text = chars.slice(0, LENGTH - start)
    for (let k = 0; k < text.length; k++) next[start + k] = text[k]
    commit(next)
    focusBox(start + text.length)
  }

  function change(i: number, raw: string) {
    const chars = clean(raw)
    if (!chars) {
      const next = [...slots]
      next[i] = ""
      commit(next)
      return
    }
    // Typing into a box that still holds its old character.
    if (chars.length === 2 && slots[i]) {
      fill(i, chars[0] === slots[i] ? chars[1] : chars[0])
      return
    }
    // Autofill or a multi-character entry spreads over the following boxes.
    fill(i, chars)
  }

  function keyDown(i: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !slots[i] && i > 0) {
      event.preventDefault()
      const next = [...slots]
      next[i - 1] = ""
      commit(next)
      focusBox(i - 1)
    } else if (event.key === "ArrowLeft") {
      event.preventDefault()
      focusBox(i - 1)
    } else if (event.key === "ArrowRight") {
      event.preventDefault()
      focusBox(i + 1)
    }
  }

  function paste(i: number, event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault()
    const chars = clean(event.clipboardData.getData("text"))
    // A whole code always starts at the first box.
    if (chars) fill(chars.length >= LENGTH ? 0 : i, chars)
  }

  function groupBlur(event: FocusEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget)) return
    onBlur?.()
  }

  return (
    <div
      role="group"
      aria-label="验证码"
      className={cn("grid grid-cols-6 gap-2", className)}
      onBlur={groupBlur}
    >
      {slots.map((char, i) => (
        <input
          key={i}
          ref={(el) => {
            inputs.current[i] = el
          }}
          id={i === 0 ? id : undefined}
          aria-label={`第 ${i + 1} 位`}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          autoComplete={i === 0 ? autoComplete : "off"}
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          value={char}
          disabled={disabled}
          onChange={(event) => change(i, event.target.value)}
          onKeyDown={(event) => keyDown(i, event)}
          onPaste={(event) => paste(i, event)}
          // Selecting the character lets typing replace it in place.
          onFocus={(event) => event.target.select()}
          onMouseUp={(event) => {
            event.preventDefault()
            event.currentTarget.select()
          }}
          className={cn(
            "h-12 w-full min-w-0 rounded-md border border-foreground/25 bg-transparent text-center font-mono text-lg font-medium caret-transparent transition-[border-color,box-shadow] outline-none selection:bg-foreground/10",
            "hover:border-foreground/45 focus:border-foreground focus:ring-2 focus:ring-foreground/10",
            invalid &&
              "border-destructive hover:border-destructive focus:border-destructive focus:ring-destructive/20",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
        />
      ))}
    </div>
  )
}
