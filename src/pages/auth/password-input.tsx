import { useState, type ComponentProps, type FocusEventHandler } from "react"
import { EyeIcon, EyeOffIcon } from "lucide-react"

import { AUTH_HIT, AUTH_INPUT_GROUP } from "@/components/auth-shell"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"

/** Underlined password field with a show/hide toggle. */
export function PasswordInput({
  onGroupBlur,
  ...props
}: ComponentProps<typeof InputGroupInput> & {
  /** Focus left the input and its toggle button. */
  onGroupBlur?: FocusEventHandler<HTMLDivElement>
}) {
  const [visible, setVisible] = useState(false)
  return (
    <InputGroup
      className={AUTH_INPUT_GROUP}
      onBlur={(event) => {
        // Moving between the input and the eye button is not leaving.
        if (event.currentTarget.contains(event.relatedTarget)) return
        onGroupBlur?.(event)
      }}
    >
      <InputGroupInput
        className="px-0"
        type={visible ? "text" : "password"}
        {...props}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          className={AUTH_HIT}
          aria-label={visible ? "隐藏密码" : "显示密码"}
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}
