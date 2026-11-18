/**
 * Copy text, also on plain-HTTP origins where `navigator.clipboard` is
 * undefined (it exists only in secure contexts). Resolves to false when the
 * browser refused both ways, so the caller can offer manual copy.
 */
export async function copyText(text: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall through to the legacy path (e.g. permission denied).
    }
  }
  return legacyCopy(text)
}

function legacyCopy(text: string): boolean {
  // Mount inside an open modal, if any, so its focus trap doesn't steal the selection.
  const host = document.activeElement?.closest('[role="dialog"]') ?? document.body
  const previous = document.activeElement as HTMLElement | null
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none'
  host.appendChild(area)
  area.select()
  let ok: boolean
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  area.remove()
  previous?.focus({ preventScroll: true })
  return ok
}
