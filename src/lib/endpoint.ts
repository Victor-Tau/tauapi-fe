/**
 * The public model API host users point their SDKs at. The backend's own
 * `server_address` setting is not reliable (it can be localhost), so the
 * console shows this fixed host.
 */
export const API_ORIGIN = "https://api.mltvrsai.com"

/** OpenAI/Claude-compatible SDK base URL shown on the dashboard. */
export const SDK_BASE_URL = API_ORIGIN

/** Claude Code settings example (~/.claude/settings.json). */
export const CLAUDE_CODE_SETTINGS = JSON.stringify(
  {
    $schema: "https://json.schemastore.org/claude-code-settings.json",
    env: {
      // Claude Code appends /v1/messages itself, so this is the bare host.
      ANTHROPIC_BASE_URL: API_ORIGIN,
      ANTHROPIC_AUTH_TOKEN: "sk-替换为你的 API 密钥",
      ANTHROPIC_MODEL: "claude-sonnet-5-5",
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    },
    model: "sonnet",
    modelSettings: {
      "claude-sonnet-5-5": {
        effortLevel: "high",
      },
    },
    skipDangerousModePermissionPrompt: true,
    theme: "dark",
  },
  null,
  2
)
