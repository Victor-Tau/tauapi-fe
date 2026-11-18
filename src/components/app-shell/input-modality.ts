/**
 * Last input modality. `:focus-visible` alone is not enough: a popup that
 * hands focus back to its trigger after a mouse interaction can still match
 * it if the last key press was earlier. Keyboard expansion of the rail and
 * its cards only happens when the most recent input really was a key.
 */
let keyboard = false

if (typeof window !== "undefined") {
  window.addEventListener(
    "keydown",
    (event) => {
      if (!event.metaKey && !event.ctrlKey && !event.altKey) keyboard = true
    },
    true
  )
  const toPointer = () => {
    keyboard = false
  }
  window.addEventListener("pointerdown", toPointer, true)
  window.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType === "mouse") toPointer()
    },
    true
  )
}

/** True when focus arrived by keyboard (Tab, arrows…). Call from handlers. */
export function isKeyboardFocus(target: Element) {
  return keyboard && target.matches(":focus-visible")
}
