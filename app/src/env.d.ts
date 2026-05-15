/// <reference types="vite/client" />

declare module '*.vue' {
  import { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- reason: standard Vue component type declaration requires any
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare global {
  interface Window {
    __TAROT_TEST_API__?: {
      showResult: (payload: {
        question?: string
        readingResult: import('./core/api/types').ReadingResult
        drawnCards?: import('./core/api/types').DrawnResult[]
      }) => void
      reset: () => void
    }
  }
}

export {}
