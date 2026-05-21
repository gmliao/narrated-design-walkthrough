<!--
  GlobalCaptions — compact bottom-center caption window.

  Driven entirely by useTTSPlayback (no own state). Mounted from global-bottom.vue
  so it renders once across the whole deck, and visually persists across slide
  transitions (caption naturally swaps to the new slide's narration via the shared
  composable).
-->
<template>
  <Teleport to="body">
    <div v-if="captionVisible" class="gc-caption" aria-live="polite">
      <div class="gc-caption-window" :style="{ '--gc-caption-font-size': `${tts.captionFontSize.value}rem` }">
        <div class="gc-caption-line">
          <template v-for="token in currentCue?.tokens ?? []" :key="`${currentCueIdx}-${token.start}-${token.end}`">
            <span
              v-if="token.text.trim()"
              class="gc-caption-token"
              :class="{ 'gc-caption-token--active': activeCharIndex >= token.start && activeCharIndex < token.end }"
            >{{ token.text }}</span>
            <span v-else>{{ token.text }}</span>
          </template>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- End-of-walkthrough banner (autoplay finished on last slide). -->
  <Teleport to="body">
    <div v-if="walkthroughComplete" class="gc-end-banner" aria-live="polite">
      End of walkthrough
    </div>
  </Teleport>

  <!-- Hidden marker for headless recording tools (e.g. Playwright) to detect completion. -->
  <div v-if="walkthroughComplete" class="walkthrough-complete" aria-hidden="true" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTTSPlayback } from '../composables/useTTSPlayback'

const tts = useTTSPlayback()

// Re-expose as direct names for the template
const captionVisible = tts.captionVisible
const captionCues = tts.captionCues
const currentCueIdx = tts.currentCueIdx
const activeCharIndex = tts.activeCharIndex
const walkthroughComplete = tts.walkthroughComplete

const currentCue = computed(() => captionCues.value[currentCueIdx.value])
</script>

<style scoped>
.gc-caption {
  bottom: calc(4.85rem + env(safe-area-inset-bottom));
  display: flex;
  justify-content: center;
  left: 0;
  pointer-events: none;
  position: fixed;
  right: 0;
  z-index: 34;
}

.gc-caption-window {
  background: rgba(15, 23, 42, 0.78);
  -webkit-backdrop-filter: blur(14px) saturate(150%);
  backdrop-filter: blur(14px) saturate(150%);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 14px;
  box-shadow: 0 10px 32px rgba(2, 6, 23, 0.45);
  box-sizing: content-box;
  color: #f8fafc;
  font-size: var(--gc-caption-font-size, 1rem);
  font-weight: 600;
  line-height: 1.45;
  max-width: min(52vw, 25em);
  overflow: hidden;
  padding: 0.25em 0.6em 0.3em;
}

.gc-caption-line {
  display: -webkit-box;
  line-height: 1.45;
  max-height: 1.45em;
  overflow: hidden;
  text-align: center;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
}

.gc-caption-token {
  transition: color 140ms ease, text-shadow 140ms ease;
}

.gc-caption-token--active {
  color: #facc15;
  text-shadow: 0 0 10px rgba(250, 204, 21, 0.45);
}

.gc-end-banner {
  background: rgba(15, 23, 42, 0.78);
  -webkit-backdrop-filter: blur(14px) saturate(150%);
  backdrop-filter: blur(14px) saturate(150%);
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 999px;
  bottom: calc(0.5rem + env(safe-area-inset-bottom));
  color: #f8fafc;
  font-size: clamp(0.92rem, 1.4vw, 1.18rem);
  font-weight: 600;
  left: 50%;
  letter-spacing: 0.02em;
  opacity: 0;
  padding: 0.55rem 1.4rem;
  pointer-events: none;
  position: fixed;
  transform: translateX(-50%);
  z-index: 34;
  animation: gc-end-banner-show 4.5s ease forwards;
}

@keyframes gc-end-banner-show {
  0%   { opacity: 0; }
  10%  { opacity: 1; }
  85%  { opacity: 1; }
  100% { opacity: 0; }
}

/* Marker is intentionally invisible — purely a DOM signal for headless tools. */
.walkthrough-complete {
  display: none;
}
</style>
