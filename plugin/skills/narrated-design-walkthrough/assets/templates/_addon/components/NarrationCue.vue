<!--
  NarrationCue — invisible per-slide narration registration.

  Each slide drops one <NarrationCue :text="`...`" /> in its content. The cue reads
  its containing slide's page number from useSlideContext().$page and registers
  narration keyed by that page. The GlobalCaptions / NavControls consumers look
  up narration for the currently visible slide via useNav().currentSlideNo.

  Narration text supports [h:anchor-id]...[/h] markup. TTS speaks the
  markup-stripped text; spotlight rings the corresponding [data-walkthrough-anchor]
  element while that caption cue is active.
-->
<template>
  <span aria-hidden="true" class="narration-cue-marker" />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useSlideContext } from '@slidev/client'
import { useNarration } from '../composables/useNarration'

const props = defineProps<{ text: string }>()
const ctx = useSlideContext()
const { register, unregister } = useNarration()

const slidePage = computed(() => {
  const p = ctx?.$page
  if (typeof p === 'number') return p
  // Slidev exposes $page as a ref in newer versions; .value if applicable
  const maybeRef = p as { value?: number } | undefined
  return maybeRef?.value ?? 0
})

onMounted(() => {
  if (slidePage.value) register(slidePage.value, props.text)
})

onBeforeUnmount(() => {
  if (slidePage.value) unregister(slidePage.value)
})

watch(
  () => [slidePage.value, props.text] as const,
  ([nextPage, nextText], [prevPage, prevText] = [0, '']) => {
    if (nextPage === prevPage && nextText === prevText) return
    if (prevPage && prevText) unregister(prevPage)
    if (nextPage && nextText) register(nextPage, nextText)
  },
)
</script>

<style scoped>
.narration-cue-marker {
  display: none;
}
</style>
