<script setup lang="ts">
/**
 * Application entry — phase-2.1 skeleton.
 *
 * onLaunch dispatches between the main route and the fallback route based
 * on the success of two critical bootstrap resources:
 *   - tarotStore.loadCards() — fetches the 78-card metadata
 *   - themeStore.loadTheme() — fetches the current theme bundle
 *
 * Per PRD §2.2 #2 (and the architecture spec for phase-2.1), if either
 * resource fails the app reLaunches to the fallback route; otherwise it
 * stays on the default main route. The dispatcher uses Promise.allSettled
 * so a partial failure on either resource still gives both store actions a
 * chance to write their respective error refs before we redirect.
 */
import { onLaunch } from '@dcloudio/uni-app'
import { useTarotStore } from './stores/tarot'
import { useThemeStore } from './stores/theme'

const tarotStore = useTarotStore()
const themeStore = useThemeStore()

const FALLBACK_ROUTE = '/pages/fallback/index'

onLaunch(() => {
  void bootstrap()
})

async function bootstrap(): Promise<void> {
  // Fire both critical loads in parallel; allSettled lets us inspect each
  // outcome independently. A reject on either side, *or* a fulfilled call
  // that leaves the corresponding error ref populated (the stores write
  // the error there on caught failure), routes the user to the fallback.
  const [cardsResult, themeResult] = await Promise.allSettled([
    tarotStore.loadCards(),
    themeStore.loadTheme(),
  ])

  const cardsFailed = cardsResult.status === 'rejected'
    || tarotStore.cardsLoadError !== null
  const themeFailed = themeResult.status === 'rejected'
    || themeStore.loadError !== null

  if (cardsFailed || themeFailed) {
    uni.reLaunch({ url: FALLBACK_ROUTE })
  }
  // Otherwise stay on the default main route (pages/main/index).
}
</script>

<style>
/*
 * @import must precede all other CSS statements per the CSS spec, so
 * the global token / utility imports come first. The H5-only
 * @font-face declarations follow below.
 */
@import "./styles/global.css";
@import "./styles/overlay/_tokens.css";

/*
 * Font faces — H5 only.
 * ----------------------------------------------------------------
 * Declared here (in the App.vue SFC <style> block) instead of in
 * styles/global.css because uni-app's conditional compilation
 * directives (#ifdef H5 / #endif) reliably strip blocks only inside
 * SFC styles and .scss inputs. Plain .css files imported via @import
 * are processed by vite/postcss before the mp-weixin asset rewriter
 * gets a chance to honor the H5 guard, which then fails resolving
 * `/static/themes/...` (the rewriter prefixes it to `@/static/...`).
 *
 * The actual WOFF2 files live at `server/public/static/themes/...`
 * and are served by the backend at the origin-relative path; vite's
 * `publicDir` (set to `../server/public` in app/vite.config.ts) makes
 * them addressable as `/static/...` on H5 regardless of host.
 *
 * Mini-program font injection is handled separately by the theme
 * store (see stores/theme.ts) — the WeChat runtime does not honor
 * @font-face from regular stylesheets.
 */
/* #ifdef H5 */
@font-face {
  font-family: 'Cinzel';
  src: url('/static/themes/golden_dawn/fonts/cinzel-400.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Cinzel';
  src: url('/static/themes/golden_dawn/fonts/cinzel-600.woff2') format('woff2');
  font-weight: 600;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Cinzel';
  src: url('/static/themes/golden_dawn/fonts/cinzel-700.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'LXGW WenKai';
  src: url('/static/themes/golden_dawn/fonts/lxgw-wenkai-light.woff2') format('woff2');
  font-weight: 300;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'LXGW WenKai';
  src: url('/static/themes/golden_dawn/fonts/lxgw-wenkai-regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
/* #endif */
</style>
