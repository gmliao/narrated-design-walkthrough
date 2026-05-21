<!--
  GlobalCaptions — bottom-center 3-line lyrics caption window.

  Driven entirely by useTTSPlayback (no own state). Mounted from global-bottom.vue
  so it renders once across the whole deck, and visually persists across slide
  transitions (caption naturally swaps to the new slide's narration via the shared
  composable).
-->
<template>
  <div v-if="captionVisible" class="gc-caption" aria-live="polite">
    <div class="gc-caption-window">
      <div class="gc-caption-stack" :style="{ transform: `translateY(calc(${-currentCueIdx} * var(--gc-line-height)))` }">
        <div class="gc-caption-line gc-caption-spacer" aria-hidden="true">&nbsp;</div>
        <div
          v-for="(cue, index) in captionCues"
          :key="`cue-${index}`"
          class="gc-caption-line"
          :class="lineClass(index)"
        >
          <template v-for="token in cue.tokens" :key="`${index}-${token.start}-${token.end}`">
            <span
              v-if="token.text.trim()"
              class="gc-caption-token"
              :class="{ 'gc-caption-token--active': index === currentCueIdx && hasBoundaryEvent && activeCharIndex >= token.start && activeCharIndex < token.end }"
            >{{ token.text }}</span>
            <span v-else>{{ token.text }}</span>
          </template>
        </div>
        <div class="gc-caption-line gc-caption-spacer" aria-hidden="true">&nbsp;</div>
      </div>
    </div>
  </div>

  <!-- End-of-walkthrough banner (autoplay finished on last slide). -->
  <div v-if="walkthroughComplete" class="gc-end-banner" aria-live="polite">
    End of walkthrough
  </div>

  <!-- Hidden marker for headless recording tools (e.g. Playwright) to detect completion. -->
  <div v-if="walkthroughComplete" class="walkthrough-complete" aria-hidden="true" />
</template>

<script setup lang="ts">
import { useTTSPlayback } from '../composables/useTTSPlayback'

const tts = useTTSPlayback()

// Re-expose as direct names for the template
const captionVisible = tts.captionVisible
const captionCues = tts.captionCues
const currentCueIdx = tts.currentCueIdx
const activeCharIndex = tts.activeCharIndex
const hasBoundaryEvent = tts.hasBoundaryEvent
const walkthroughComplete = tts.walkthroughComplete

function lineClass(index: number) {
  const diff = index - currentCueIdx.value
  if (diff === 0) return 'gc-caption-line--current'
  if (diff === -1) return 'gc-caption-line--prev'
  if (diff === 1) return 'gc-caption-line--next'
  return 'gc-caption-line--far'
}
</script>

<style scoped>
.gc-caption {
  --gc-line-height: 1.85em;
  bottom: calc(0.5rem + env(safe-area-inset-bottom));
  display: flex;
  justify-content: center;
  left: 0;
  pointer-events: none;
  position: fixed;
  right: 0;
  z-index: 34;
}

.gc-caption-window {
  background: rgba(15, 23, 42, 0.55);
  -webkit-backdrop-filter: blur(14px) saturate(150%);
  backdrop-filter: blur(14px) saturate(150%);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 14px;
  box-shadow: 0 10px 32px rgba(2, 6, 23, 0.45);
  box-sizing: content-box;
  color: #f8fafc;
  font-size: clamp(0.92rem, 1.4vw, 1.18rem);
  font-weight: 600;
  line-height: 1.45;
  max-width: min(64vw, 52rem);
  overflow: hidden;
  padding: 0.85rem 1.6rem 0.9rem;
  height: calc(var(--gc-line-height) * 3);
}

.gc-caption-stack {
  display: flex;
  flex-direction: column;
  transition: transform 360ms cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
}

.gc-caption-line {
  height: var(--gc-line-height);
  line-height: var(--gc-line-height);
  opacity: 0;
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
  transition: opacity 280ms ease, color 280ms ease;
  white-space: nowrap;
}

.gc-caption-spacer { opacity: 0; }

.gc-caption-line--prev {
  color: rgba(226, 232, 240, 0.55);
  opacity: 0.55;
}

.gc-caption-line--current {
  color: #f8fafc;
  opacity: 1;
}

.gc-caption-line--next {
  color: rgba(226, 232, 240, 0.7);
  opacity: 0.6;
}

.gc-caption-line--far { opacity: 0; }

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
