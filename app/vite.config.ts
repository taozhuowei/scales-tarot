import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [uni()],
  resolve: {
    alias: {
      // Use gsap-core (no CSSPlugin) to avoid DOM API calls that crash WeChat Mini Program
      gsap: path.resolve(__dirname, "../node_modules/gsap/gsap-core.js"),
    },
  },
  build: mode === 'production'
    ? {
        minify: 'terser',
        terserOptions: {
          compress: { drop_console: true, drop_debugger: true },
        },
      }
    : { minify: false },
}));
