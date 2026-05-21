<!--
  TTSNavButtons — Listen/Pause/Stop/CC/Voice buttons styled as Slidev nav icons.

  Mounted from global-bottom.vue. Uses Vue <Teleport> to physically insert these
  buttons INTO Slidev's own nav <div> (the parent of .slidev-icon-btn), so they
  render as siblings of prev/next/overview/etc. They inherit Slidev's button
  styling via the slidev-icon-btn class and Slidev's controls-foreground colors.
-->
<template>
  <Teleport :to="targetEl" :disabled="!targetEl">
    <button
      v-if="!hidden"
      class="slidev-icon-btn slidev-tts-btn"
      :class="{ 'slidev-tts-btn--primary': true, 'slidev-tts-btn--auto': tts.autoplay.value }"
      :disabled="!tts.isSupported || !tts.cleanText.value"
      :title="primaryButtonTitle"
      @click="tts.toggle"
    >
      <span v-if="tts.isSpeaking.value">⏸</span>
      <span v-else-if="tts.autoplay.value">⏵⏵</span>
      <span v-else>▶</span>
    </button>
    <button
      v-if="!hidden && (tts.isSpeaking.value || tts.isPaused.value)"
      class="slidev-icon-btn slidev-tts-btn"
      title="Stop narration"
      @click="tts.stop"
    >
      <span>■</span>
    </button>
    <button
      v-if="!hidden"
      class="slidev-icon-btn slidev-tts-btn"
      :class="{ 'slidev-tts-btn--active': tts.autoplay.value }"
      :disabled="!tts.isSupported"
      :title="tts.autoplay.value ? 'Autoplay on — click to cancel' : 'Toggle autoplay (auto-advance slides when narration ends)'"
      @click="tts.toggleAutoplay"
    >
      <span class="slidev-tts-text-icon">AUTO</span>
    </button>
    <button
      v-if="!hidden"
      class="slidev-icon-btn slidev-tts-btn"
      :class="{ 'slidev-tts-btn--active': tts.showCaptions.value }"
      :disabled="!tts.cleanText.value"
      title="Toggle captions"
      @click="tts.toggleCaptions"
    >
      <span class="slidev-tts-text-icon">CC</span>
    </button>
    <button
      v-if="!hidden"
      class="slidev-icon-btn slidev-tts-btn"
      :class="{ 'slidev-tts-btn--active': tts.settingsOpen.value }"
      :disabled="!tts.isSupported"
      title="Voice settings"
      @click="tts.toggleSettings"
    >
      <span class="slidev-tts-text-icon">V</span>
    </button>
  </Teleport>

  <Teleport to="body">
    <div v-if="tts.settingsOpen.value" class="tts-voice-popover">
      <label class="tts-voice-label" for="tts-voice-select">Voice</label>
      <select
        id="tts-voice-select"
        v-model="tts.selectedVoiceName.value"
        class="tts-voice-select"
        :disabled="!tts.isSupported || tts.voiceOptions.value.length === 0"
        @change="tts.rememberVoice"
      >
        <option value="">Auto voice</option>
        <option v-for="voice in tts.voiceOptions.value" :key="voice.name" :value="voice.name">
          {{ voice.name }} · {{ voice.lang }}{{ voice.localService ? ' · local' : '' }}
        </option>
      </select>
      <div class="tts-voice-status">{{ tts.statusText.value }}</div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useNav } from '@slidev/client'
import { useTTSPlayback } from '../composables/useTTSPlayback'

const tts = useTTSPlayback()
const nav = useNav()

const targetEl = ref<HTMLElement | null>(null)
const hidden = ref(false)
let attempts = 0
let timer: number | undefined

const primaryButtonTitle = computed(() => {
  if (tts.isSpeaking.value) return 'Pause narration'
  if (tts.isPaused.value) return 'Resume narration'
  if (tts.autoplay.value) return 'Start autoplay (Listen + auto-advance slides)'
  return tts.statusText.value
})

// Wire up autoplay advance: when a narration utterance ends naturally and autoplay is
// on, advance Slidev to the next slide; the slide change re-triggers speak() via the
// currentNarration watch inside useTTSPlayback. On the last slide, mark complete.
//
// Implementation note: we deliberately do NOT call useNav().next() directly. The
// shape of that API has shifted across Slidev versions (`next` is sometimes a
// page-level click stepper rather than a slide advancer, sometimes named
// `nextSlide`, sometimes only available via $slidev.nav.go). Instead, we synthesize
// a click on Slidev's native "next slide" button — that's the user-facing source
// of truth and works regardless of internal API churn.
function handleNarrationEnded() {
  if (!tts.autoplay.value) return
  const navObj = nav as unknown as Record<string, { value?: number }>
  const cur = navObj.currentSlideNo?.value ?? 1
  const total = navObj.total?.value ?? cur
  if (cur < total) {
    const nextBtn = document.querySelector('button[title*="next slide"]') as HTMLButtonElement | null
    if (nextBtn) {
      nextBtn.click()
    } else {
      // Fallback: try useNav().next() as a last resort
      const fn = (nav as unknown as Record<string, unknown>).next
      if (typeof fn === 'function') (fn as () => void)()
    }
  } else {
    tts.markWalkthroughComplete()
  }
}

function findSlidevNavContainer(): HTMLElement | null {
  // Slidev's bottom nav lives inside <nav class="flex flex-col"> within
  // .slidev-slide-container > div.absolute.bottom-0. The actual button row is
  // a <div> inside that <nav>. We avoid matching slide-content icon buttons
  // (code-block copy, Mermaid zoom, etc.) which share the .slidev-icon-btn
  // class but live elsewhere in the DOM.
  const navEl = document.querySelector('nav.flex.flex-col') as HTMLElement | null
  if (!navEl) return null
  // Find the inner row that holds the .slidev-icon-btn siblings.
  const row = navEl.querySelector(':scope > div, :scope > div > div')
  if (row && row.querySelector('.slidev-icon-btn')) return row as HTMLElement
  // Fallback: use the nav itself.
  return navEl
}

function tryAttach() {
  const found = findSlidevNavContainer()
  if (found) {
    targetEl.value = found
    return
  }
  attempts += 1
  if (attempts < 60) {
    timer = window.setTimeout(tryAttach, 200)
  } else {
    // Give up — render inline (Teleport disabled). The buttons still work,
    // they just won't be inside Slidev's nav.
    hidden.value = false
  }
}

onMounted(() => {
  tryAttach()
  tts.setOnNarrationEnded(handleNarrationEnded)
})

onBeforeUnmount(() => {
  if (timer) window.clearTimeout(timer)
  tts.setOnNarrationEnded(null)
})
</script>

<style>
/* Global (not scoped) — these styles must apply once the buttons are teleported
   into Slidev's nav, which sits outside this component's scope. */

.slidev-tts-btn {
  /* Matches Slidev's .slidev-icon-btn intrinsic feel but uses our color
     accents for the primary Listen button. */
  position: relative;
}

.slidev-tts-btn--primary {
  color: rgb(125, 211, 252);
}

.slidev-tts-btn--primary:hover {
  color: rgb(186, 230, 253);
}

.slidev-tts-btn--active {
  color: rgb(186, 230, 253);
}

.slidev-tts-btn--auto {
  color: rgb(252, 211, 77);
}

.slidev-tts-btn--auto:hover {
  color: rgb(253, 224, 71);
}

.slidev-tts-text-icon {
  font-size: 0.72em;
  font-weight: 700;
  letter-spacing: 0.04em;
  line-height: 1;
}

.tts-voice-popover {
  background: rgba(15, 23, 42, 0.96);
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 10px;
  bottom: 3.6rem;
  box-shadow: 0 14px 36px rgba(15, 23, 42, 0.42);
  color: #e2e8f0;
  left: 50%;
  padding: 0.75rem;
  position: fixed;
  transform: translateX(-50%);
  width: min(22rem, calc(100vw - 2rem));
  z-index: 80;
}

.tts-voice-label {
  color: #94a3b8;
  display: block;
  font-size: 0.62rem;
  font-weight: 700;
  margin-bottom: 0.35rem;
  text-transform: uppercase;
}

.tts-voice-status {
  color: #94a3b8;
  font-size: 0.68rem;
  margin-top: 0.45rem;
}

.tts-voice-select {
  background: #020617;
  border: 1px solid #334155;
  border-radius: 8px;
  color: #e2e8f0;
  font-size: 0.74rem;
  min-height: 2rem;
  padding: 0.35rem 0.5rem;
  width: 100%;
}
</style>
