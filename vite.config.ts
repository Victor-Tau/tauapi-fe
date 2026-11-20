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
  // Optional dev HTTPS (needed to test session-cookie refresh from a remote
  // origin). Point both variables at PEM files kept outside the repo.
  const https =
    env.DEV_HTTPS_KEY && env.DEV_HTTPS_CERT
      ? {
          key: readFileSync(env.DEV_HTTPS_KEY),
          cert: readFileSync(env.DEV_HTTPS_CERT),
        }
      : undefined
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
      https,
      // Allow access via public IP / domain / tunnel hostnames.
      allowedHosts: true,
      proxy: {
        "/api": {
          target: env.API_PROXY_TARGET || "http://70.39.180.109:3000",
          changeOrigin: true,
          // The backend is reached by IP, so its certificate cannot match.
          secure: !env.API_PROXY_TARGET?.startsWith("https://"),
          timeout: 20_000,
          proxyTimeout: 20_000,
        },
      },
    },
    preview: { host: "127.0.0.1", port: 4174, strictPort: true },
    build: { sourcemap: false },
  }
})
