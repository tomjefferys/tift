import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'
import HelloWorld from '../Word.vue'

describe('Word', () => {
  it('renders properly', () => {
    const wrapper = mount(HelloWorld, { props: { word: 'Hello' } })
    expect(wrapper.text()).toContain('Hello')
  })
})
