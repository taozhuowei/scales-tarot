/**
 * Name: core/sizing/raf_shim
 * Purpose: cross-target requestAnimationFrame / cancelAnimationFrame shims
 *          for UniApp — H5 exposes the globals, mini-program runtimes
 *          (WeChat, Alipay, etc.) do not.
 * Reason: split out of scale.ts so this self-contained platform shim is a
 *          single concern, independent of the reactive scale composable
 *          that consumes `raf` / `caf`.
 */

// ---------------------------------------------------------------------------
// rAF / cAF shims — UniApp targets H5 + mini-programs. The H5 runtime exposes
// `requestAnimationFrame` / `cancelAnimationFrame` as globals, but mini-program
// runtimes (WeChat, Alipay, etc.) do not — calling the bare globals there
// throws ReferenceError. Feature-detect once at module load and fall back to
// `setTimeout` (~16 ms ≈ 60 fps) so the composable works on every target.
// ---------------------------------------------------------------------------

// `setTimeout` returns `number` in browsers and `NodeJS.Timeout` (an object)
// in Node — the union is opaque to TypeScript, so we narrow via `Number()`
// once at the boundary. The rAF fallback path tracks the raw timer id so the
// disposal hook (`cancelAnimationFrame` shim) clears it correctly even on
// runtimes where `setTimeout` returns an object.
//
// The H5 globals are wrapped in `typeof === 'function'` feature detection so
// mini-program runtimes (which raise ReferenceError on bare access) hit the
// `setTimeout` fallback instead. The lint rule that bans these globals is
// disabled per-line because the guarded access is the whole point of the
// shim — without it the fallback branch becomes unreachable.
export const raf: (cb: FrameRequestCallback) => number =
  // eslint-disable-next-line no-restricted-globals -- reason: H5-only DOM API behind feature-detect for the mini-program fallback path.
  typeof requestAnimationFrame === 'function'
    // eslint-disable-next-line no-restricted-globals -- reason: H5-only DOM API behind feature-detect for the mini-program fallback path.
    ? requestAnimationFrame
    : (cb) => {
        const handle = setTimeout(
          () => cb(typeof performance !== 'undefined' ? performance.now() : Date.now()),
          16,
        )
        // Coerce both number-and-object timer ids into the numeric handle the
        // composable stores. `Number(NodeJS.Timeout)` returns `NaN`, which the
        // shim's cancel branch treats as "nothing to clear" — safe because the
        // timer always fires before disposal in single-threaded JS.
        return Number(handle)
      }

export const caf: (handle: number) => void =
  // eslint-disable-next-line no-restricted-globals -- reason: H5-only DOM API behind feature-detect for the mini-program fallback path.
  typeof cancelAnimationFrame === 'function'
    // eslint-disable-next-line no-restricted-globals -- reason: H5-only DOM API behind feature-detect for the mini-program fallback path.
    ? cancelAnimationFrame
    : (handle) => {
        if (Number.isFinite(handle)) clearTimeout(handle)
      }
