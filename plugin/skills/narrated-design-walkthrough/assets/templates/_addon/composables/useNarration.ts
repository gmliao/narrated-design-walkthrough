/**
 * Per-slide narration registry. Slidev pre-mounts neighbor slides during transitions,
 * so we can't rely on mount order — every NarrationCue must declare its own slide page
 * via useSlideContext().$page, register keyed by that page, and the consumer picks the
 * narration for whichever page is currently visible via useNav().currentSlideNo.
 */

import { computed, ref } from 'vue'
import { useNav } from '@slidev/client'

const narrationMap = ref(new Map<number, string>())

export function useNarration() {
  function register(page: number, text: string) {
    if (!page || !text) return
    const next = new Map(narrationMap.value)
    next.set(page, text)
    narrationMap.value = next
  }

  function unregister(page: number) {
    if (!page) return
    if (!narrationMap.value.has(page)) return
    const next = new Map(narrationMap.value)
    next.delete(page)
    narrationMap.value = next
  }

  const nav = useNav()
  const currentNarration = computed(() => {
    const page = nav?.currentSlideNo?.value ?? 1
    return narrationMap.value.get(page) ?? ''
  })

  return { register, unregister, currentNarration }
}
