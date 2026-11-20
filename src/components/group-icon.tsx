import { useMemo } from "react"
import { LayersIcon } from "lucide-react"

import cnGroupIcon from "@/assets/group-cn.svg?raw"
import { ModelIcon, modelBrand } from "@/components/model-icon"
import { cn } from "@/lib/utils"
import type { PricingCatalog, PricingModel, PricingVendor } from "@/types/api"

/** Hand-picked marks for named groups; others use their models' vendor. */
const GROUP_ICONS: Record<string, string> = {
  国模: cnGroupIcon,
}

/** Shared by every model in the group; null for mixed or unknown groups. */
export type GroupVendorIcon = {
  model: string
  vendor: PricingVendor | undefined
} | null

/** The vendor mark shared by all `models` of a group, if they share one. */
export function groupVendorIcon(
  models: PricingModel[],
  vendorsById: Map<number, PricingVendor>
): GroupVendorIcon {
  const vendorOf = (m: PricingModel) => vendorsById.get(m.vendor_id ?? -1)
  const brands = new Set(
    models.map((m) => modelBrand(m.model_name, vendorOf(m)))
  )
  const [first] = models
  if (!first || brands.size !== 1 || brands.has(null)) return null
  return { model: first.model_name, vendor: vendorOf(first) }
}

/** Group name → shared vendor mark, built from the pricing catalog. */
export function useGroupVendorIcons(catalog: PricingCatalog | undefined) {
  return useMemo(() => {
    const icons = new Map<string, GroupVendorIcon>()
    if (!catalog) return icons
    const vendorsById = new Map(catalog.vendors.map((v) => [v.id, v]))
    const byGroup = new Map<string, PricingModel[]>()
    for (const model of catalog.models) {
      for (const name of model.enable_groups) {
        const list = byGroup.get(name)
        if (list) list.push(model)
        else byGroup.set(name, [model])
      }
    }
    for (const [name, models] of byGroup) {
      icons.set(name, groupVendorIcon(models, vendorsById))
    }
    return icons
  }, [catalog])
}

/**
 * A group's mark, as on the models page: a hand-picked mark, else the vendor
 * shared by all its models, else a generic stack.
 */
export function GroupIcon({
  name,
  icon,
  className,
}: {
  name: string
  icon: GroupVendorIcon | undefined
  className?: string
}) {
  const custom = GROUP_ICONS[name]
  if (custom) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex size-4 shrink-0 [&>svg]:size-full",
          className
        )}
        // Bundled static asset, not user data.
        dangerouslySetInnerHTML={{ __html: custom }}
      />
    )
  }
  if (icon) {
    return (
      <ModelIcon
        model={icon.model}
        vendor={icon.vendor}
        className={className}
      />
    )
  }
  return (
    <LayersIcon
      className={cn("size-4 shrink-0", className)}
      aria-hidden="true"
    />
  )
}
