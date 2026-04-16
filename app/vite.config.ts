import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import path from 'path'

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'

  return {
    plugins: [uni()],
    envDir: path.resolve(__dirname, '..'),
    resolve: {
      alias: {
        // Use gsap-core (no CSSPlugin) to avoid DOM-only APIs in WeChat Mini Program.
        gsap: path.resolve(__dirname, '../node_modules/gsap/gsap-core.js'),
      },
    },
    build: {
      minify: isProduction ? 'terser' : false,
      sourcemap: !isProduction,
      cssMinify: isProduction,
      // Skip gzip-size reporting even in prod — it adds 1–3s to CI for no
      // operational benefit; we care about bytes on disk, which are already
      // logged by vite's regular output.
      reportCompressedSize: false,
      terserOptions: isProduction
        ? {
            compress: {
              passes: 2,
              drop_console: true,
              drop_debugger: true,
            },
            mangle: {
              safari10: true,
            },
            format: {
              comments: false,
            },
          }
        : undefined,
    },
  }
})
