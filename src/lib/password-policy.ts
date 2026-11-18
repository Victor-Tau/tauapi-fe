/**
 * Front-end rule for a new account password: letters and digits, plus an
 * uppercase letter or a special character. The server itself only enforces
 * 8–128 characters, which is checked here too.
 */
export interface PasswordRule {
  label: string
  test: (password: string) => boolean
}

export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    label: "8–128 个字符",
    test: (p) => [...p].length >= 8 && [...p].length <= 128,
  },
  { label: "包含字母", test: (p) => /[A-Za-z]/.test(p) },
  { label: "包含数字", test: (p) => /\d/.test(p) },
  {
    label: "包含大写字母或特殊字符",
    test: (p) => /[A-Z]/.test(p) || /[^A-Za-z0-9\s]/.test(p),
  },
]

export function passwordMeetsPolicy(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password))
}
