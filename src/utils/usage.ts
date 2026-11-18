export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function localDateBounds(start: string, end: string): { start_timestamp: number; end_timestamp: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return null
  const startDate = new Date(`${start}T00:00:00`)
  const endDate = new Date(`${end}T23:59:59`)
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) return null
  if (localDateKey(startDate) !== start || localDateKey(endDate) !== end) return null
  if (startDate.getTime() > endDate.getTime()) return null
  const startTimestamp = Math.floor(startDate.getTime() / 1000)
  const endTimestamp = Math.min(Math.floor(endDate.getTime() / 1000), Math.floor(Date.now() / 1000))
  if (startTimestamp > endTimestamp) return null
  return { start_timestamp: startTimestamp, end_timestamp: endTimestamp }
}
