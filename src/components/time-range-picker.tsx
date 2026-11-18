import { useState } from "react"
import { ArrowRightIcon, CalendarIcon, ChevronDownIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import {
  exceedsMaxRange,
  maxRangeMessage,
  rangeToDateKeys,
  resolvePreset,
  resolveRange,
  TIME_PRESETS,
  timeRangeLabel,
  type TimeRange,
} from "@/utils/time-range"
import { localDateBounds, localDateKey } from "@/utils/usage"

/**
 * Period dropdown: quick presets in a two-column grid (applied on click) and
 * a start/end date pair applied with "应用". Presets longer than the server's
 * log range limit are dimmed; choosing one explains the limit in place
 * instead of sending a request the server would reject.
 */
export function TimeRangePicker({
  value,
  onChange,
  maxDays,
  className,
}: {
  value: TimeRange
  onChange: (range: TimeRange) => void
  /** `log_max_range_days` from the site status. */
  maxDays?: number
  /** Applied to the trigger (e.g. a fixed width to line up with filters). */
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")
  const [touched, setTouched] = useState(false)
  const [presetError, setPresetError] = useState("")

  function openChange(next: boolean) {
    if (next) {
      // The date fields start from whatever period is applied right now.
      const current = resolveRange(value)
      const keys = current ? rangeToDateKeys(current) : null
      setStart(keys?.start ?? "")
      setEnd(keys?.end ?? "")
      setTouched(false)
      setPresetError("")
    }
    setOpen(next)
  }

  function pick(range: TimeRange) {
    onChange(range)
    setOpen(false)
  }

  const today = localDateKey(new Date())
  const bounds = start && end ? localDateBounds(start, end) : null
  let error = ""
  if (!start || !end) error = "请选择开始日期和结束日期。"
  else if (!bounds) error = "结束日期不得早于开始日期，且开始日期不能在未来。"
  else if (exceedsMaxRange(bounds, maxDays)) error = maxRangeMessage(maxDays!)

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className={cn(
              "group/range min-w-36 justify-start tabular-nums",
              className
            )}
            aria-label={`时间范围：${timeRangeLabel(value)}`}
          />
        }
      >
        <CalendarIcon data-icon="inline-start" />
        <span className="min-w-0 truncate">{timeRangeLabel(value)}</span>
        <ChevronDownIcon
          data-icon="inline-end"
          className="ml-auto text-muted-foreground transition-transform duration-200 group-aria-expanded/range:rotate-180"
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[22rem] gap-0 p-0">
        <div
          role="listbox"
          aria-label="快捷时间范围"
          className="grid grid-cols-2 gap-1 p-2"
        >
          {TIME_PRESETS.map((preset) => {
            const selected =
              value.kind === "preset" && value.preset === preset.key
            const tooLong = exceedsMaxRange(resolvePreset(preset.key), maxDays)
            return (
              <button
                key={preset.key}
                type="button"
                role="option"
                aria-selected={selected}
                aria-disabled={tooLong || undefined}
                onClick={() => {
                  if (tooLong) setPresetError(maxRangeMessage(maxDays!))
                  else pick({ kind: "preset", preset: preset.key })
                }}
                className={cn(
                  "press h-9 rounded-lg text-sm text-muted-foreground outline-none hover:bg-nav-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-disabled:opacity-45",
                  selected &&
                    "bg-nav-active font-medium text-foreground hover:bg-nav-active"
                )}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
        {presetError && (
          <FieldError role="alert" className="px-4 pb-2">
            {presetError}
          </FieldError>
        )}
        <Separator />
        <form
          noValidate
          className="flex flex-col gap-3 p-3"
          onSubmit={(event) => {
            event.preventDefault()
            setTouched(true)
            if (!error) pick({ kind: "custom", start, end })
          }}
        >
          <div className="flex items-end gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">开始日期</span>
              <Input
                type="date"
                value={start}
                max={today}
                required
                aria-invalid={touched && Boolean(error)}
                onChange={(event) => {
                  setStart(event.target.value)
                  setTouched(true)
                  setPresetError("")
                }}
                className="tabular-nums"
              />
            </label>
            <ArrowRightIcon
              aria-hidden="true"
              className="mb-2.5 size-4 shrink-0 text-muted-foreground"
            />
            <label className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">结束日期</span>
              <Input
                type="date"
                value={end}
                max={today}
                required
                aria-invalid={touched && Boolean(error)}
                onChange={(event) => {
                  setEnd(event.target.value)
                  setTouched(true)
                  setPresetError("")
                }}
                className="tabular-nums"
              />
            </label>
          </div>
          {touched && error && <FieldError>{error}</FieldError>}
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {maxDays ? `最长可查询 ${maxDays} 天` : null}
            </span>
            <Button
              type="submit"
              size="sm"
              disabled={touched && Boolean(error)}
            >
              应用
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  )
}
