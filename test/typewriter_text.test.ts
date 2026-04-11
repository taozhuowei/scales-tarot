// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import TypewriterText from '../app/src/components/TypewriterText.vue'

function mockMatchMedia(matches = false) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

describe('TypewriterText', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockMatchMedia(false)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders text progressively with the configured delay', async () => {
    const wrapper = mount(TypewriterText, {
      props: {
        text: 'ABC',
        startDelay: 10,
        charInterval: 20,
      },
    })

    expect(wrapper.text()).toBe('')

    await vi.advanceTimersByTimeAsync(10)
    await nextTick()
    expect(wrapper.text()).toBe('A')

    await vi.advanceTimersByTimeAsync(20)
    await nextTick()
    expect(wrapper.text()).toBe('AB')

    await vi.advanceTimersByTimeAsync(20)
    await nextTick()
    expect(wrapper.text()).toBe('ABC')
  })

  it('renders immediately when instant is true', async () => {
    const wrapper = mount(TypewriterText, {
      props: {
        text: 'Immediate',
        instant: true,
      },
    })

    await nextTick()
    expect(wrapper.text()).toBe('Immediate')
  })

  it('restarts the animation when text changes', async () => {
    const wrapper = mount(TypewriterText, {
      props: {
        text: 'Hello',
        startDelay: 0,
        charInterval: 30,
      },
    })

    await vi.advanceTimersByTimeAsync(59)
    await nextTick()
    expect(wrapper.text()).toBe('He')

    await wrapper.setProps({ text: 'World' })
    expect(wrapper.text()).toBe('')

    await vi.advanceTimersByTimeAsync(29)
    await nextTick()
    expect(wrapper.text()).toBe('W')
  })
})
