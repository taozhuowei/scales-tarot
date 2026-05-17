<script setup lang="ts">
/**
 * Application entry — phase-2.1 skeleton.
 *
 * onLaunch dispatches between the main route and the fallback route based
 * on the success of two critical bootstrap resources:
 *   - tarotStore.loadCards() — fetches the 78-card metadata
 *   - themeStore.loadTheme() — fetches the current theme bundle
 *
 * Per docs/prd/glossary.md（路由 #2） (and the architecture spec for phase-2.1), if either
 * resource fails the app reLaunches to the fallback route; on success the
 * app must land on the main route. The dispatcher uses Promise.allSettled
 * so a partial failure on either resource still gives both store actions a
 * chance to write their respective error refs before we redirect.
 *
 * Recovery semantics: if the user previously hit a transient outage they
 * are now sitting on the fallback route (uni-app keeps the current route
 * across H5 refreshes / mini-program restarts). When bootstrap subsequently
 * succeeds we must proactively reLaunch back to the main route — otherwise
 * the user stays stuck on "宇宙信号微弱" even after the API recovers. The
 * launched-page identity is read from `onLaunch`'s LaunchShowOption.path,
 * which is populated before the page stack is initialised (so we cannot
 * use getCurrentPages() — at onLaunch time the stack is empty).
 */
import { onLaunch } from '@dcloudio/uni-app'
import { useTarotStore } from './core/store/tarot'
import { useThemeStore } from './core/store/theme'

const tarotStore = useTarotStore()
const themeStore = useThemeStore()

const MAIN_ROUTE = '/pages/main/index'
const FALLBACK_ROUTE = '/pages/fallback/index'

onLaunch((options) => {
  // LaunchShowOption.path is leading-slash-stripped (e.g. 'pages/fallback/index').
  // Capture it synchronously here — by the time bootstrap()'s awaits resolve
  // the user could have navigated, so we must not read it post-await.
  const launchedFromFallback = options?.path?.includes('fallback') === true
  void bootstrap(launchedFromFallback)
})

async function bootstrap(launchedFromFallback: boolean): Promise<void> {
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
    return
  }

  // Bootstrap succeeded. If the launch route was the fallback page (e.g.
  // user refreshed after a transient outage that has since recovered),
  // redirect them back to the main route. Otherwise the current main
  // route is already correct and no navigation is needed.
  if (launchedFromFallback) {
    uni.reLaunch({ url: MAIN_ROUTE })
  }
}
</script>

<style>
/*
 * @import must precede all other CSS statements per the CSS spec, so
 * the global token / utility imports come first. The H5-only
 * @font-face declarations follow below.
 */
@import "./core/styles/global.css";
@import "./core/styles/overlay/_tokens.css";

/*
 * Font faces — H5 only.
 * ----------------------------------------------------------------
 * Declared here (in the App.vue SFC <style> block) instead of in
 * core/styles/global.css because uni-app's conditional compilation
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
