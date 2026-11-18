import { z } from "zod"

import { validateKeyForm, type KeyFormValues } from "@/utils/key-form"

/**
 * The rules live in `validateKeyForm` (shared with the old console); this
 * schema only maps its result onto per-field issues for react-hook-form.
 */
export function keyFormSchema(allowedGroups: readonly string[]) {
  return z
    .object({
      name: z.string(),
      expiration: z.enum(["never", "custom"]),
      expiresAt: z.string(),
      unlimited: z.boolean(),
      remainingQuota: z.string(),
      group: z.string(),
      restrictModels: z.boolean(),
      models: z.string(),
      allowIps: z.string(),
    })
    .superRefine((values, ctx) => {
      const errors = validateKeyForm(values, allowedGroups)
      for (const [field, message] of Object.entries(errors)) {
        if (message) ctx.addIssue({ code: "custom", path: [field], message })
      }
    }) satisfies z.ZodType<KeyFormValues, KeyFormValues>
}
