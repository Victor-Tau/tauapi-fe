import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // API_PROXY_TARGET is only read here; it is never exposed to client code.
  const env = loadEnv(mode, process.cwd(), "")
  // Front-end version shown in the sidebar's version card (package.json).
  const pkg = JSON.parse(
    readFileSync(resolve(import.meta.dirname, "package.json"), "utf8")
  ) as { version: string }
  return {
    plugins: [react(), tailwindcss()],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    resolve: {
      alias: {
        "@": resolve(import.meta.dirname, "./src"),
      },
    },
    server: {
      host: "0.0.0.0",
      port: 5174,
      strictPort: true,
      // Allow access via public IP / domain / tunnel hostnames.
      allowedHosts: true,
      proxy: {
        "/api": {
          target: env.API_PROXY_TARGET || "http://43.173.126.193:3000",
          changeOrigin: true,
          timeout: 20_000,
          proxyTimeout: 20_000,
        },
      },
    },
    preview: { host: "127.0.0.1", port: 4174, strictPort: true },
    build: { sourcemap: false },
  }
})
