/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { resolveApiBaseUrlForCommand, resolveDevApiProxyTarget } from './src/shared/config/apiOrigin.ts'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiBaseUrl = resolveApiBaseUrlForCommand(env.VITE_API_BASE_URL, command)

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiBaseUrl),
    },
    server: command === 'build'
      ? undefined
      : {
          proxy: {
            '/api': {
              target: resolveDevApiProxyTarget(env.DEV_API_PROXY_TARGET),
              changeOrigin: false,
            },
          },
        },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: true,
    },
  }
})
