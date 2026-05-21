<!--
  TTSNavButtons — Listen/Pause/Stop/CC/Voice buttons styled as Slidev nav icons.

  Mounted from global-bottom.vue. Uses Vue <Teleport> to physically insert these
  buttons INTO Slidev's own nav <div> (the parent of .slidev-icon-btn), so they
  render as siblings of prev/next/overview/etc. They inherit Slidev's button
  styling via the slidev-icon-btn class and Slidev's controls-foreground colors.
-->
<template>
  <!-- Teleport into Slidev's nav when found; overlay fallback otherwise -->
  <Teleport :to="targetEl" :disabled="!targetEl">
    <div :class="useOverlay ? 'tts-overlay' : 'tts-inline-btns'">
      <button
        class="slidev-icon-btn slidev-tts-btn"
        :class="{ 'slidev-tts-btn--primary': true, 'slidev-tts-btn--auto': tts.autoplay.value }"
        :disabled="!tts.isSupported || !tts.cleanText.value"
        :title="primaryButtonTitle"
        @click="handlePrimaryClick"
      >
        <span v-if="tts.isSpeaking.value">⏸</span>
        <span v-else-if="tts.autoplay.value">⏵⏵</span>
        <span v-else>▶</span>
      </button>
      <button
        v-if="tts.isSpeaking.value || tts.isPaused.value"
        class="slidev-icon-btn slidev-tts-btn"
        title="Stop narration"
        @click="tts.stop"
      >
        <span>■</span>
      </button>
      <button
        class="slidev-icon-btn slidev-tts-btn"
        :class="{ 'slidev-tts-btn--active': tts.autoplay.value }"
        :disabled="!tts.isSupported"
        :title="tts.autoplay.value ? 'Autoplay on — click to cancel' : 'Toggle autoplay'"
        @click="tts.toggleAutoplay"
      >
        <span class="slidev-tts-text-icon">AUTO</span>
      </button>
      <button
        class="slidev-icon-btn slidev-tts-btn tts-cc-btn"
        :class="{ 'slidev-tts-btn--active': tts.showCaptions.value }"
        :disabled="!tts.cleanText.value"
        title="Caption size"
        @click.stop="ccMenuOpen = !ccMenuOpen"
      >
        <span class="slidev-tts-text-icon">CC</span>
      </button>
      <button
        class="slidev-icon-btn slidev-tts-btn"
        :class="{ 'slidev-tts-btn--active': tts.settingsOpen.value }"
        :disabled="!tts.isSupported"
        title="Playback settings"
        @click="tts.toggleSettings"
      >
        <span class="slidev-tts-text-icon">V</span>
      </button>
    </div>
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
      <label class="tts-voice-label tts-settings-label" for="tts-rate-range">Speed {{ tts.playbackRate.value.toFixed(2) }}x</label>
      <input
        id="tts-rate-range"
        v-model.number="tts.playbackRate.value"
        class="tts-settings-range"
        type="range"
        min="0.75"
        max="1.35"
        step="0.05"
        @input="tts.rememberPlaybackRate"
      >
      <div class="tts-voice-status">{{ tts.statusText.value }}</div>
    </div>
  </Teleport>

  <Teleport to="body">
    <template v-if="ccMenuOpen">
      <div class="tts-cc-backdrop" @click="ccMenuOpen = false" />
      <div class="tts-cc-menu">
        <button class="tts-cc-menu-btn" :class="{ 'tts-cc-menu-btn--active': ccPreset === 'lg' }" @click="setCaptionPreset('lg')">大</button>
        <button class="tts-cc-menu-btn" :class="{ 'tts-cc-menu-btn--active': ccPreset === 'md' }" @click="setCaptionPreset('md')">中</button>
        <button class="tts-cc-menu-btn" :class="{ 'tts-cc-menu-btn--active': ccPreset === 'sm' }" @click="setCaptionPreset('sm')">小</button>
        <button class="tts-cc-menu-btn" :class="{ 'tts-cc-menu-btn--active': ccPreset === 'off' }" @click="setCaptionPreset('off')">關</button>
      </div>
    </template>
  </Teleport>

  <Teleport to="body">
    <div v-if="startupPromptOpen" class="tts-startup-backdrop" role="dialog" aria-modal="true" aria-labelledby="tts-startup-title">
      <div class="tts-startup-dialog">
        <div id="tts-startup-title" class="tts-startup-title">Walkthrough playback</div>
        <label class="tts-startup-row">
          <input v-model="startupAutoplay" type="checkbox">
          <span>Auto-play narration and spotlight</span>
        </label>
        <label class="tts-startup-row">
          <input v-model="startupCaptions" type="checkbox">
          <span>Show captions</span>
        </label>
        <label class="tts-voice-label tts-settings-label" for="tts-startup-rate">Speed {{ tts.playbackRate.value.toFixed(2) }}x</label>
        <input
          id="tts-startup-rate"
          v-model.number="tts.playbackRate.value"
          class="tts-settings-range"
          type="range"
          min="0.75"
          max="1.35"
          step="0.05"
          @input="tts.rememberPlaybackRate"
        >
        <div class="tts-startup-actions">
          <button class="tts-startup-secondary" type="button" @click="dismissStartupPrompt">Later</button>
          <button class="tts-startup-primary" type="button" @click="applyStartupPrompt">Start</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useNav } from '@slidev/client'
import { useTTSPlayback } from '../composables/useTTSPlayback'

const tts = useTTSPlayback()
const nav = useNav()

const targetEl = ref<HTMLElement | null>(null)
const useOverlay = ref(false)
const startupPromptOpen = ref(false)
const startupAutoplay = ref(false)
const startupCaptions = ref(true)
const ccMenuOpen = ref(false)
let attempts = 0
let timer: number | undefined
let forcedControlsWrapper: HTMLElement | null = null
let startupStopHandle: (() => void) | undefined
const STARTUP_PROMPT_KEY = 'narrated-design-walkthrough.startupPromptSeen'

const primaryButtonTitle = computed(() => {
  if (tts.isSpeaking.value) return 'Pause narration'
  if (tts.isPaused.value) return 'Resume narration'
  if (tts.autoplay.value) return 'Start autoplay (Listen + auto-advance slides)'
  return tts.statusText.value
})

const ccPreset = computed(() => {
  if (!tts.showCaptions.value) return 'off'
  if (tts.captionFontSize.value >= 1.3) return 'lg'
  if (tts.captionFontSize.value >= 1.0) return 'md'
  return 'sm'
})

function setCaptionPreset(preset: 'lg' | 'md' | 'sm' | 'off') {
  if (preset === 'off') {
    tts.showCaptions.value = false
  } else {
    tts.showCaptions.value = true
    if (preset === 'lg') tts.captionFontSize.value = 1.35
    else if (preset === 'md') tts.captionFontSize.value = 1.1
    else tts.captionFontSize.value = 0.9
    tts.rememberCaptionFontSize()
  }
  ccMenuOpen.value = false
}

function handlePrimaryClick() {
  tts.toggle()
}

function shouldShowStartupPrompt() {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  if (params.get('setup') === '1') return true
  if (params.get('play') && params.get('play') !== '0' && params.get('play') !== 'false') return false
  return !window.sessionStorage.getItem(STARTUP_PROMPT_KEY)
}

function openStartupPromptWhenReady() {
  if (!shouldShowStartupPrompt()) return
  if (tts.cleanText.value) {
    startupPromptOpen.value = true
    return
  }
  startupStopHandle = watch(
    () => tts.cleanText.value,
    (text) => {
      if (!text) return
      startupPromptOpen.value = true
      startupStopHandle?.()
      startupStopHandle = undefined
    },
  )
}

function markStartupPromptSeen() {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(STARTUP_PROMPT_KEY, '1')
}

function dismissStartupPrompt() {
  markStartupPromptSeen()
  startupPromptOpen.value = false
}

function applyStartupPrompt() {
  markStartupPromptSeen()
  startupPromptOpen.value = false
  tts.showCaptions.value = startupCaptions.value
  tts.rememberPlaybackRate()
  tts.rememberCaptionFontSize()
  if (startupAutoplay.value) {
    tts.startAutoplay()
  } else {
    tts.startSingle()
  }
}

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
  // Strategy 1: Slidev v52 nav element with flex flex-col classes
  const navEl = document.querySelector('nav.flex.flex-col') as HTMLElement | null
  if (navEl) {
    const row = navEl.querySelector(':scope > div, :scope > div > div')
    if (row && row.querySelector('.slidev-icon-btn')) return row as HTMLElement
    return navEl
  }
  // Strategy 2: any element that already contains slidev-icon-btn buttons
  // but is NOT inside a slide (avoids code-block copy / Mermaid zoom buttons)
  const btns = Array.from(document.querySelectorAll('.slidev-icon-btn'))
  for (const btn of btns) {
    const parent = btn.parentElement
    if (parent && !parent.closest('.slidev-slide') && !parent.closest('[data-slidev-slide]')) {
      return parent
    }
  }
  // Strategy 3: the bottom-fixed controls bar (Slidev v52 alternate class)
  const controls = document.querySelector('.slidev-nav, [class*="slidev-controls"], .controls') as HTMLElement | null
  if (controls) return controls
  return null
}

function keepSlidevControlsVisible(host: HTMLElement) {
  host.classList.add('tts-inline-host')
  const wrapper = host.closest('.absolute.bottom-0.left-0') as HTMLElement | null
  if (wrapper) {
    forcedControlsWrapper = wrapper
    wrapper.classList.add('tts-controls-visible')
  }
}

function tryAttach() {
  const found = findSlidevNavContainer()
  if (found) {
    keepSlidevControlsVisible(found)
    targetEl.value = found
    return
  }
  attempts += 1
  if (attempts < 60) {
    timer = window.setTimeout(tryAttach, 200)
  } else {
    // Nav not found after 12s — fall back to fixed overlay so buttons are
    // always reachable regardless of Slidev's internal DOM structure.
    useOverlay.value = true
  }
}

onMounted(() => {
  tryAttach()
  tts.setOnNarrationEnded(handleNarrationEnded)
  nextTick(openStartupPromptWhenReady)
})

onBeforeUnmount(() => {
  if (timer) window.clearTimeout(timer)
  startupStopHandle?.()
  targetEl.value?.classList.remove('tts-inline-host')
  forcedControlsWrapper?.classList.remove('tts-controls-visible')
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

.tts-settings-label {
  margin-top: 0.75rem;
}

.tts-settings-range {
  accent-color: #7dd3fc;
  width: 100%;
}

.tts-startup-backdrop {
  align-items: center;
  background: rgba(2, 6, 23, 0.46);
  display: flex;
  inset: 0;
  justify-content: center;
  position: fixed;
  z-index: 120;
}

.tts-startup-dialog {
  background: rgba(15, 23, 42, 0.97);
  border: 1px solid rgba(148, 163, 184, 0.32);
  border-radius: 12px;
  box-shadow: 0 24px 70px rgba(2, 6, 23, 0.56);
  color: #e2e8f0;
  padding: 1rem;
  width: min(22rem, calc(100vw - 2rem));
}

.tts-startup-title {
  color: #f8fafc;
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
}

.tts-startup-row {
  align-items: center;
  display: flex;
  font-size: 0.82rem;
  gap: 0.55rem;
  margin: 0.55rem 0;
}

.tts-startup-row input {
  accent-color: #7dd3fc;
}

.tts-startup-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-top: 1rem;
}

.tts-startup-primary,
.tts-startup-secondary {
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 700;
  padding: 0.45rem 0.75rem;
}

.tts-startup-primary {
  background: #7dd3fc;
  color: #082f49;
}

.tts-startup-secondary {
  background: rgba(148, 163, 184, 0.12);
  color: #cbd5e1;
}

/* Fallback overlay — used when Slidev's nav container can't be found */
.tts-overlay {
  align-items: center;
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 10px;
  bottom: 1.2rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  display: flex;
  gap: 0.25rem;
  left: 50%;
  padding: 0.35rem 0.6rem;
  position: fixed;
  transform: translateX(-50%);
  z-index: 100;
}

.tts-inline-btns {
  display: contents;
}

.tts-controls-visible {
  opacity: 1 !important;
  right: 0;
}

.tts-cc-backdrop {
  bottom: 0;
  left: 0;
  position: fixed;
  right: 0;
  top: 0;
  z-index: 79;
}

.tts-cc-menu {
  background: rgba(15, 23, 42, 0.96);
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 10px;
  bottom: 3.6rem;
  box-shadow: 0 14px 36px rgba(15, 23, 42, 0.42);
  display: flex;
  flex-direction: column;
  left: 50%;
  overflow: hidden;
  position: fixed;
  transform: translateX(-50%);
  z-index: 80;
}

.tts-cc-menu-btn {
  background: transparent;
  border: none;
  color: #e2e8f0;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.5rem 1.5rem;
  text-align: center;
  transition: background 100ms ease, color 100ms ease;
}

.tts-cc-menu-btn:hover {
  background: rgba(148, 163, 184, 0.12);
}

.tts-cc-menu-btn--active {
  color: #7dd3fc;
}
</style>
