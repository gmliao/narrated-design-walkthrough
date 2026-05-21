/**
 * Single shared playback engine for the walkthrough's narration.
 *
 * Two consumers read from the same state:
 *   - TTSNavButtons.vue  → Listen/Pause/Stop/CC/Voice buttons teleported into Slidev's nav
 *   - GlobalCaptions.vue → 3-line lyrics caption window
 *
 * Watches the active narration (from useNarration) and stops cleanly when the user
 * navigates to a different slide. Drives DOM spotlight on [data-walkthrough-anchor]
 * elements when narration enters a [h:id]...[/h] markup range.
 *
 * Autoplay (recording mode):
 *   Opening any walkthrough URL with ?play=1 enables autoplay. When the current
 *   narration finishes via natural utterance.onend, the registered "narration ended"
 *   handler fires — typically wired up by TTSNavButtons to advance Slidev to the next
 *   slide. The new slide's narration then auto-speaks via the currentNarration watch.
 *   When the last slide's narration ends, `walkthroughComplete` flips to true and
 *   GlobalCaptions renders a hidden `.walkthrough-complete` marker that headless
 *   recording tools (e.g. Playwright) can detect.
 */

import { computed, nextTick, ref, watch } from 'vue'
import { useNarration } from './useNarration'

type CaptionToken = { text: string; start: number; end: number }
type AnchorRange = { start: number; end: number; anchors: string[] }
type CaptionCue = {
  startToken: number
  endToken: number
  startChar: number
  endChar: number
  tokens: CaptionToken[]
  anchors: string[]
}

const VOICE_STORAGE_KEY = 'narrated-design-walkthrough.voiceName'
const PLAYBACK_RATE_STORAGE_KEY = 'narrated-design-walkthrough.playbackRate'
const CAPTION_FONT_SIZE_STORAGE_KEY = 'narrated-design-walkthrough.captionFontSize'
const SPOTLIGHT_CLASS = 'walkthrough-spotlight'

const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

const isSpeaking = ref(false)
const isPaused = ref(false)
const showCaptions = ref(true)
const settingsOpen = ref(false)
const voices = ref<SpeechSynthesisVoice[]>([])
const selectedVoiceName = ref('')
const playbackRate = ref(0.95)
const captionFontSize = ref(1.35)
const activeCharIndex = ref(0)
const hasBoundaryEvent = ref(false)

const autoplay = ref(false)
const walkthroughComplete = ref(false)

// Detect ?play=1 URL parameter on module init. Autoplay can be toggled at runtime
// via toggleAutoplay() too (e.g. exposed by a button on the UI).
function detectAutoplayFromUrl() {
  if (typeof window === 'undefined') return
  try {
    const params = new URLSearchParams(window.location.search)
    const flag = params.get('play')
    if (flag && flag !== '0' && flag !== 'false') autoplay.value = true
  } catch {
    // ignore
  }
}
detectAutoplayFromUrl()

// External handler invoked when a narration utterance ends naturally (not via stop/error
// /slide-change). TTSNavButtons wires this to nav.next() so autoplay advances slides.
let onNarrationEndedHandler: (() => void) | null = null

const { currentNarration } = useNarration()

const parsedSource = computed(() => parseMarkup(currentNarration.value))
// IMPORTANT: do NOT collapse whitespace here. parseMarkup emits anchor ranges in the
// stripped-but-uncollapsed coordinate space; cues must live in the same space so the
// anchor overlap check is exact. The token segmenter and TTS both handle multi-space
// gracefully, so leaving whitespace intact has no audible / visual downside.
const cleanText = computed(() => parsedSource.value.cleanText)
const anchorRanges = computed(() => parsedSource.value.anchorRanges)

const targetLang = ref('zh-TW')

const captionVisible = computed(() => Boolean(cleanText.value) && showCaptions.value && (isSpeaking.value || isPaused.value))

const isApplePlatform = computed(() => {
  if (typeof navigator === 'undefined') return false
  const platform = navigator.platform || ''
  const userAgent = navigator.userAgent || ''
  return /Mac|iPhone|iPad|iPod/.test(platform) || /Mac OS X|iPhone|iPad|iPod/.test(userAgent)
})

const voiceOptions = computed(() => {
  const langPrefix = targetLang.value.split('-')[0]
  const matching = voices.value.filter((v) => v.lang === targetLang.value || v.lang.startsWith(`${langPrefix}-`) || v.lang.startsWith(langPrefix))
  return matching.length > 0 ? matching : voices.value
})

const statusText = computed(() => {
  if (!isSupported) return 'Speech unavailable'
  if (!cleanText.value) return 'No narration'
  if (isSpeaking.value) return 'Speaking'
  if (isPaused.value) return 'Paused'
  return 'Ready'
})

const captionTokens = computed(() => segmentText(cleanText.value))

const captionCues = computed<CaptionCue[]>(() => {
  const tokens = captionTokens.value
  if (tokens.length === 0) return []

  const cues: CaptionCue[] = []
  let startToken = 0
  let startChar = tokens[0].start

  const pushCue = (endIndex: number) => {
    const startCharFinal = tokens[startToken]?.start ?? startChar
    const endCharFinal = tokens[endIndex].end
    cues.push({
      startToken,
      endToken: endIndex,
      startChar: startCharFinal,
      endChar: endCharFinal,
      tokens: tokens.slice(startToken, endIndex + 1),
      anchors: resolveAnchorsForRange(startCharFinal, endCharFinal),
    })
  }

  tokens.forEach((token, index) => {
    const span = token.end - startChar
    const isHardBreak = /[。！？!?；;]/.test(token.text)
    const isSoftBreak = /[，、,]/.test(token.text) || token.text.trim() === ''
    const shouldBreak = isHardBreak || (span > 26 && isSoftBreak) || span > 36
    if (!shouldBreak) return
    pushCue(index)
    startToken = index + 1
    startChar = tokens[index + 1]?.start ?? token.end
  })

  if (startToken < tokens.length) pushCue(tokens.length - 1)
  return cues
})

const currentCueIdx = computed(() => {
  const cues = captionCues.value
  if (cues.length === 0) return 0
  for (let i = 0; i < cues.length; i += 1) {
    if (activeCharIndex.value <= cues[i].endChar) return i
  }
  return cues.length - 1
})

function parseMarkup(raw: string): { cleanText: string; anchorRanges: AnchorRange[] } {
  if (!raw) return { cleanText: '', anchorRanges: [] }
  const ranges: AnchorRange[] = []
  let clean = ''
  const re = /\[h:([^\]]+)\]([\s\S]*?)\[\/h\]/g
  let lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) {
    clean += raw.slice(lastIndex, m.index)
    const anchors = m[1].split(',').map((s) => s.trim()).filter(Boolean)
    const inner = m[2]
    const start = clean.length
    clean += inner
    ranges.push({ start, end: clean.length, anchors })
    lastIndex = m.index + m[0].length
  }
  clean += raw.slice(lastIndex)
  return { cleanText: clean, anchorRanges: ranges }
}

function resolveAnchorsForRange(startChar: number, endChar: number): string[] {
  // cue range [startChar, endChar) and anchor range [r.start, r.end) are both
  // half-open intervals in the same coordinate space (no ratio scaling needed).
  // Overlap iff anchor.end > cue.start AND anchor.start < cue.end.
  const ranges = anchorRanges.value
  if (ranges.length === 0) return []
  const found: string[] = []
  for (const r of ranges) {
    if (r.end <= startChar) continue
    if (r.start >= endChar) continue
    for (const a of r.anchors) if (!found.includes(a)) found.push(a)
  }
  return found
}

function segmentText(text: string): CaptionToken[] {
  if (!text) return []
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const Segmenter = Intl.Segmenter as new (locale: string, options: { granularity: 'word' }) => Intl.Segmenter
    const segmenter = new Segmenter(targetLang.value, { granularity: 'word' })
    return Array.from(segmenter.segment(text)).map((s) => ({
      text: s.segment,
      start: s.index,
      end: s.index + s.segment.length,
    }))
  }
  const tokens: CaptionToken[] = []
  const pattern = /[一-鿿]|[A-Za-z0-9_+-]+|[^\S\r\n]+|./g
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0
    tokens.push({ text: match[0], start, end: start + match[0].length })
  }
  return tokens
}

function pickVoice() {
  if (!isSupported) return undefined
  const list = voices.value.length > 0 ? voices.value : window.speechSynthesis.getVoices()
  if (selectedVoiceName.value) {
    const sel = list.find((v) => v.name === selectedVoiceName.value)
    if (sel) return sel
  }
  const preferred = rankVoices(list)
  return preferred[0]
}

function rankVoices(list: SpeechSynthesisVoice[]) {
  const prefix = targetLang.value.split('-')[0]
  return [...list].sort((a, b) => scoreVoice(b, prefix) - scoreVoice(a, prefix))
}

function scoreVoice(v: SpeechSynthesisVoice, prefix: string) {
  let s = 0
  if (v.lang === targetLang.value) s += 80
  else if (v.lang.startsWith(`${prefix}-`) || v.lang.startsWith(prefix)) s += 50
  if (v.localService) s += 20
  if (isApplePlatform.value && looksLikeAppleChineseVoice(v)) s += 30
  if (/premium|enhanced|neural|natural/i.test(v.name)) s += 8
  return s
}

function looksLikeAppleChineseVoice(v: SpeechSynthesisVoice) {
  return v.localService && (
    /zh|cmn|yue/i.test(v.lang) ||
    /美佳|婷婷|雅婷|Mei-Jia|Ting-Ting|Yu-shu|Sin-ji|Li-mu|Meijia|Tingting/i.test(v.name)
  )
}

let fallbackTimer: number | undefined
let fallbackStart = 0

function completeNarration() {
  isSpeaking.value = false
  isPaused.value = false
  activeCharIndex.value = 0
  stopFallback()
  clearAllSpotlights()
  // Autoplay: notify subscriber (TTSNavButtons) so it can advance Slidev to the next slide.
  // Fired ONLY on natural/timed end, not when stop()/cancel/error interrupts.
  if (autoplay.value && onNarrationEndedHandler) onNarrationEndedHandler()
}

function startFallback(completeWhenDone = false) {
  if (fallbackTimer) window.clearInterval(fallbackTimer)
  fallbackStart = Date.now()
  const totalChars = cleanText.value.length
  const msPerChar = 180 / playbackRate.value
  fallbackTimer = window.setInterval(() => {
    if (!isSpeaking.value) { stopFallback(); return }
    if (hasBoundaryEvent.value) { stopFallback(); return }
    const elapsed = Date.now() - fallbackStart
    activeCharIndex.value = Math.min(totalChars, Math.floor(elapsed / msPerChar))
    if (completeWhenDone && activeCharIndex.value >= totalChars) completeNarration()
  }, 90)
}

function stopFallback() {
  if (fallbackTimer) {
    window.clearInterval(fallbackTimer)
    fallbackTimer = undefined
  }
}

function loadVoices() {
  if (!isSupported) return
  voices.value = rankVoices(window.speechSynthesis.getVoices())
  if (!selectedVoiceName.value) {
    const saved = window.localStorage.getItem(VOICE_STORAGE_KEY)
    if (saved && voices.value.some((v) => v.name === saved)) selectedVoiceName.value = saved
  }
}

function rememberVoice() {
  if (!isSupported) return
  if (selectedVoiceName.value) window.localStorage.setItem(VOICE_STORAGE_KEY, selectedVoiceName.value)
  else window.localStorage.removeItem(VOICE_STORAGE_KEY)
}

function loadPlaybackSettings() {
  if (typeof window === 'undefined') return
  const savedRate = Number(window.localStorage.getItem(PLAYBACK_RATE_STORAGE_KEY))
  if (Number.isFinite(savedRate) && savedRate >= 0.6 && savedRate <= 1.6) playbackRate.value = savedRate
  const savedCaptionFontSize = Number(window.localStorage.getItem(CAPTION_FONT_SIZE_STORAGE_KEY))
  if (Number.isFinite(savedCaptionFontSize) && savedCaptionFontSize >= 0.8 && savedCaptionFontSize <= 1.5) {
    captionFontSize.value = savedCaptionFontSize
  }
}

function rememberPlaybackRate() {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PLAYBACK_RATE_STORAGE_KEY, String(playbackRate.value))
}

function rememberCaptionFontSize() {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(CAPTION_FONT_SIZE_STORAGE_KEY, String(captionFontSize.value))
}

function speak() {
  if (!isSupported || !cleanText.value) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(cleanText.value)
  u.lang = targetLang.value
  const voice = pickVoice()
  if (voice) u.voice = voice
  u.rate = playbackRate.value
  u.pitch = 1
  u.onboundary = (event) => {
    if (typeof event.charIndex !== 'number') return
    hasBoundaryEvent.value = true
    activeCharIndex.value = event.charIndex
    stopFallback()
  }
  u.onend = () => {
    completeNarration()
  }
  u.onerror = () => {
    isSpeaking.value = false
    isPaused.value = false
    stopFallback()
    clearAllSpotlights()
  }
  activeCharIndex.value = 0
  hasBoundaryEvent.value = false
  window.speechSynthesis.speak(u)
  isSpeaking.value = true
  isPaused.value = false
  window.setTimeout(() => {
    if (isSpeaking.value && !hasBoundaryEvent.value) startFallback()
  }, 1200)
}

function toggle() {
  if (!isSupported) return
  if (isSpeaking.value) {
    window.speechSynthesis.pause()
    isSpeaking.value = false
    isPaused.value = true
    return
  }
  if (isPaused.value) {
    window.speechSynthesis.resume()
    isSpeaking.value = true
    isPaused.value = false
    return
  }
  speak()
}

function startSingle() {
  autoplay.value = false
  walkthroughComplete.value = false
  speak()
}

function startAutoplay() {
  autoplay.value = true
  walkthroughComplete.value = false
  speak()
}

function stop() {
  if (isSupported) window.speechSynthesis.cancel()
  isSpeaking.value = false
  isPaused.value = false
  activeCharIndex.value = 0
  stopFallback()
  clearAllSpotlights()
}

function toggleCaptions() {
  showCaptions.value = !showCaptions.value
}

function toggleSettings() {
  settingsOpen.value = !settingsOpen.value
}

let activeSpotlights = new Set<string>()

function applySpotlight(anchors: string[]) {
  if (typeof document === 'undefined') return
  for (const id of anchors) {
    // Anchor ids are unique to one slide by design — no need to filter by visibility.
    // (Slidev applies CSS scale transforms during transitions which can make
    // getBoundingClientRect briefly return zero-bound rects, which would have
    // falsely excluded the legitimate target on the visible slide.)
    document.querySelectorAll(`[data-walkthrough-anchor~="${id}"]`).forEach((el) => {
      el.classList.add(SPOTLIGHT_CLASS)
    })
  }
}

function removeSpotlight(anchors: string[]) {
  if (typeof document === 'undefined') return
  for (const id of anchors) {
    document.querySelectorAll(`[data-walkthrough-anchor~="${id}"]`).forEach((el) => {
      el.classList.remove(SPOTLIGHT_CLASS)
    })
  }
}

function clearAllSpotlights() {
  if (typeof document === 'undefined') return
  document.querySelectorAll(`.${SPOTLIGHT_CLASS}`).forEach((el) => el.classList.remove(SPOTLIGHT_CLASS))
  activeSpotlights = new Set()
}

// Apply / release spotlight as cue advances.
watch(
  () => ({ idx: currentCueIdx.value, cues: captionCues.value, speaking: isSpeaking.value || isPaused.value }),
  ({ idx, cues, speaking }) => {
    if (!speaking) {
      if (activeSpotlights.size > 0) clearAllSpotlights()
      return
    }
    const next = new Set(cues[idx]?.anchors ?? [])
    const toRemove: string[] = []
    activeSpotlights.forEach((a) => { if (!next.has(a)) toRemove.push(a) })
    const toAdd: string[] = []
    next.forEach((a) => { if (!activeSpotlights.has(a)) toAdd.push(a) })
    if (toRemove.length > 0) removeSpotlight(toRemove)
    if (toAdd.length > 0) applySpotlight(toAdd)
    activeSpotlights = next
  },
)

// Slide navigation → narration text changes → stop everything cleanly. If autoplay
// is active and we have new narration to play, kick it off after stop settles.
watch(currentNarration, async (next, prev) => {
  if (next === prev) return
  stop()
  if (autoplay.value && next && !walkthroughComplete.value) {
    // Wait one tick after stop() so SpeechSynthesis.cancel() has flushed before we speak again.
    await nextTick()
    // Small extra delay because some browsers (esp. Chrome on Linux) drop the first
    // utterance if cancel() is still settling.
    window.setTimeout(() => {
      if (!autoplay.value || walkthroughComplete.value || isSpeaking.value) return
      speak()
    }, 80)
  }
})

function setOnNarrationEnded(handler: (() => void) | null) {
  onNarrationEndedHandler = handler
}

function markWalkthroughComplete() {
  walkthroughComplete.value = true
  // Autoplay paused at the end; user can toggle off / replay manually.
  autoplay.value = false
}

function toggleAutoplay() {
  autoplay.value = !autoplay.value
  walkthroughComplete.value = false
}

let voicesInitialized = false

function ensureInit() {
  if (voicesInitialized || !isSupported) return
  loadPlaybackSettings()
  loadVoices()
  window.speechSynthesis.onvoiceschanged = loadVoices
  voicesInitialized = true
}

export function useTTSPlayback() {
  ensureInit()
  return {
    // playback state
    isSupported,
    isSpeaking,
    isPaused,
    statusText,
    cleanText,
    // captions
    showCaptions,
    captionVisible,
    captionCues,
    currentCueIdx,
    activeCharIndex,
    hasBoundaryEvent,
    // voice settings
    settingsOpen,
    voices,
    voiceOptions,
    selectedVoiceName,
    playbackRate,
    captionFontSize,
    isApplePlatform,
    // autoplay / recording mode
    autoplay,
    walkthroughComplete,
    setOnNarrationEnded,
    markWalkthroughComplete,
    toggleAutoplay,
    // actions
    toggle,
    startSingle,
    startAutoplay,
    stop,
    speak,
    toggleCaptions,
    toggleSettings,
    rememberVoice,
    rememberPlaybackRate,
    rememberCaptionFontSize,
  }
}
