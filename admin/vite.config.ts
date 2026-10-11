import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'API_')
  const proxyTarget = env.API_PROXY_TARGET

  if (command === 'serve' && !proxyTarget) {
    throw new Error('请在 admin/.env.local 中配置 API_PROXY_TARGET，参考 admin/.env.example')
  }

  return {
    plugins: [react()],
    server: {
      port: 5174,
      proxy: proxyTarget ? {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      } : undefined,
    },
  }
})
