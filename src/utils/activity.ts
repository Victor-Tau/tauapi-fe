import { localDateKey } from './usage'

/** Columns of the heatmap: the current week plus the 52 before it. */
export const ACTIVITY_WEEKS = 53

export type ActivityMode = 'daily' | 'weekly' | 'cumulative'

export interface ActivityDay {
  date: string
  /** Tokens used that day. */
  tokens: number
  /** What the cell shows in the chosen mode (day, its week, or running total). */
  value: number
  /** 0 = no use, 1–4 = quartile of the non-zero values. */
  level: 0 | 1 | 2 | 3 | 4
}

export interface ActivityGrid {
  /** One column per week (Monday first); days after today are null. */
  weeks: (ActivityDay | null)[][]
  /** Month name at the column where that month's first Monday falls. */
  months: { column: number; label: string }[]
}

export interface ActivityStats {
  total: number
  peak: number
  peakDate: string | null
  activeDays: number
  /** Consecutive active days up to today (or yesterday, if today is quiet so far). */
  currentStreak: number
  longestStreak: number
}

/** Local midnight of the Monday that starts the heatmap. */
export function activityStart(now = new Date()): Date {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const weekday = (start.getDay() + 6) % 7 // Monday = 0
  start.setDate(start.getDate() - weekday - (ACTIVITY_WEEKS - 1) * 7)
  return start
}

/** Every date from the heatmap start through today with its tokens. */
function dayList(tokens: ReadonlyMap<string, number>, now: Date): { date: string; tokens: number }[] {
  const days: { date: string; tokens: number }[] = []
  const today = localDateKey(now)
  for (const at = activityStart(now); ; at.setDate(at.getDate() + 1)) {
    const date = localDateKey(at)
    days.push({ date, tokens: tokens.get(date) ?? 0 })
    if (date === today) break
  }
  return days
}

/** Quartile cut points of the non-zero values. */
function thresholds(values: number[]): number[] {
  const sorted = values.filter((value) => value > 0).sort((a, b) => a - b)
  if (!sorted.length) return []
  return [0.25, 0.5, 0.75].map((q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))])
}

function levelOf(value: number, cuts: number[]): ActivityDay['level'] {
  if (value <= 0) return 0
  if (value <= cuts[0]) return 1
  if (value <= cuts[1]) return 2
  if (value <= cuts[2]) return 3
  return 4
}

const monthName = new Intl.DateTimeFormat('zh-CN', { month: 'short' })

export function buildActivityGrid(tokens: ReadonlyMap<string, number>, mode: ActivityMode, now = new Date()): ActivityGrid {
  const days = dayList(tokens, now)
  const weekTotals: number[] = []
  days.forEach((day, index) => {
    const week = Math.floor(index / 7)
    weekTotals[week] = (weekTotals[week] ?? 0) + day.tokens
  })
  let running = 0
  const values = days.map((day, index) => {
    running += day.tokens
    if (mode === 'weekly') return weekTotals[Math.floor(index / 7)]
    if (mode === 'cumulative') return running
    return day.tokens
  })
  // Weekly cells repeat their week's total; rank weeks, not days.
  const cuts = thresholds(mode === 'weekly' ? weekTotals : values)

  const weeks: (ActivityDay | null)[][] = Array.from({ length: ACTIVITY_WEEKS }, () => Array<ActivityDay | null>(7).fill(null))
  days.forEach((day, index) => {
    weeks[Math.floor(index / 7)][index % 7] = { ...day, value: values[index], level: levelOf(values[index], cuts) }
  })

  const months: ActivityGrid['months'] = []
  const start = activityStart(now)
  let previous = -1
  for (let column = 0; column < ACTIVITY_WEEKS; column++) {
    const monday = new Date(start)
    monday.setDate(start.getDate() + column * 7)
    if (monday.getMonth() !== previous) {
      months.push({ column, label: monthName.format(monday) })
      previous = monday.getMonth()
    }
  }
  // A partial first month too close to the next label would overlap it.
  if (months.length > 1 && months[1].column - months[0].column < 3) months.shift()
  return { weeks, months }
}

export function activityStats(tokens: ReadonlyMap<string, number>, now = new Date()): ActivityStats {
  const days = dayList(tokens, now)
  const stats: ActivityStats = { total: 0, peak: 0, peakDate: null, activeDays: 0, currentStreak: 0, longestStreak: 0 }
  let streak = 0
  for (const day of days) {
    stats.total += day.tokens
    if (day.tokens > stats.peak) {
      stats.peak = day.tokens
      stats.peakDate = day.date
    }
    if (day.tokens > 0) {
      stats.activeDays++
      streak++
      stats.longestStreak = Math.max(stats.longestStreak, streak)
    } else {
      streak = 0
    }
  }
  // Today still counts as "in progress": a quiet today does not break the run.
  let end = days.length - 1
  if (end >= 0 && days[end].tokens === 0) end--
  while (end >= 0 && days[end].tokens > 0) {
    stats.currentStreak++
    end--
  }
  return stats
}
