/**
 * API Client
 * Wraps uni.request with base URL configuration and a Promise interface.
 * Compatible with H5 and WeChat Mini Program — do NOT use axios or fetch directly.
 *
 * Base URL source: VITE_API_BASE_URL env var (build-time injection via Vite).
 * Production mini program: set VITE_API_BASE_URL to your HTTPS domain in .env.production.
 */

/**
 * Resolve API base URL:
 * - H5: empty string (same-origin, server serves both API and SPA)
 * - MP: VITE_API_BASE_URL from .env (LAN IP for dev, HTTPS domain for production)
 */
let API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
// #ifdef H5
API_BASE = ''
// #endif

export { API_BASE }

/**
 * Resolve a server-returned asset path into a URL the current platform can load.
 *
 * The server now returns origin-relative paths (e.g. /static/themes/.../x.jpeg)
 * so the payload never bakes in a specific host. Here we wrap them with API_BASE:
 *   - H5  (API_BASE='')      — stays relative, browser resolves against page origin
 *   - MP  (API_BASE='https://…') — becomes absolute, works inside the MP runtime
 *
 * Inputs that are already absolute (http:/https:) are returned unchanged so
 * external CDN URLs, when we ever introduce them, pass through.
 */
export function resolveAssetUrl(assetPath: string): string {
  if (!assetPath) return ''
  if (/^https?:\/\//i.test(assetPath)) return assetPath
  return `${API_BASE}${assetPath}`
}

interface RequestOptions<T = Record<string, unknown>> {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: T
}

export function request<TResponse>(path: string, options: RequestOptions = {}): Promise<TResponse> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${API_BASE}${path}`,
      method: options.method ?? 'GET',
      data: options.data,
      header: { 'Content-Type': 'application/json' },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as TResponse)
        } else {
          reject(new Error(`API ${res.statusCode}: ${path}`))
        }
      },
      fail(err) {
        reject(new Error(err.errMsg ?? 'Network error'))
      }
    })
  })
}
