import type { ReactNode } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

/** A titled card of label/value rows (profile and settings pages). */
export function InfoCard({
  title,
  rows,
}: {
  title: string
  rows: [label: string, value: ReactNode][]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col">
          {rows.map(([label, value], index) => (
            <div key={label}>
              {index > 0 && <Separator />}
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="min-w-0 truncate text-right font-medium tabular-nums">
                  {value}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}
