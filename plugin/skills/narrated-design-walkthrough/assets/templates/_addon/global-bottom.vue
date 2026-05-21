<!--
  Slidev auto-renders global-bottom.vue across every slide.

  Mounts:
    - GlobalCaptions   → bottom-center 3-line lyrics caption window
    - TTSNavButtons    → teleports Listen / Pause / Stop / CC / Voice buttons
                         INTO Slidev's own nav <div>, so they render as
                         first-class siblings of prev/next/overview/etc.
-->
<template>
  <GlobalCaptions />
  <TTSNavButtons />
</template>

<script setup lang="ts">
import GlobalCaptions from './components/GlobalCaptions.vue'
import TTSNavButtons from './components/TTSNavButtons.vue'
</script>
