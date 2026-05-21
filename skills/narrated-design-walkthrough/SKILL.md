---
name: narrated-design-walkthrough
description: Generate derivative Slidev walkthroughs with curated TTS narration from canonical engineering design docs and matching plans. Use when the user asks to turn docs/design or docs/plans Markdown into an audio-first, phase-aware narrated walkthrough, dogfood a design explanation, or create docs/walkthroughs artifacts without changing the canonical source docs.
---

# Narrated Design Walkthrough

## Overview

Create a consumable derivative artifact from canonical Markdown design and plan docs. The walkthrough is for async review, onboarding, stakeholder explanation, and audio-first self-review; it is not a replacement for the source design.

## Workflow

1. Identify the canonical source files:
   - Required: one `docs/design/*.md` or child-project `doc/design/*.md`.
   - Optional but preferred: matching `docs/plans/*.md` or child-project `doc/plans/*.md`.
   - Do not edit these source docs unless the user explicitly asks.

2. Classify the design before writing:
   - `schema-heavy`: database/entity/API contract changes dominate.
   - `process-heavy`: workflow, lifecycle, or sequence changes dominate.
   - `hybrid`: both are important.
   - Use this classification to choose which diagrams and slides matter.

3. Read the required references before drafting:
   - `references/narration-style.md` for speaker notes.
   - `references/slidev-layout.md` for visual fit, diagram sizing, and preview expectations.

4. Create output under `docs/walkthroughs/<date-or-source-slug>/`. A new walkthrough is **just two files**:
   - `slides.md` — content + per-slide `<NarrationCue :text>` + `data-walkthrough-anchor` elements; frontmatter must include `addons: [./_addon]` (note: `./_addon`, NOT `../_addon` — Slidev resolves addon paths relative to the npm script's cwd, which is `docs/walkthroughs/`, not relative to `slides.md`. The wrong path is a common AI agent failure mode — verify by running `npm run dev <slug>` and confirming Slidev doesn't ENOENT-fail on addon resolution.)
   - `README.md` — provenance (sourceDesign / sourcePlan / lastRegenerated) + preview instructions pointing to the shared root scripts

   The shared engine (NarrationCue / GlobalCaptions / TTSNavButtons / spotlight CSS / composables) lives once at `docs/walkthroughs/_addon/` and is referenced via Slidev's `addons` mechanism. Do NOT copy these files into each walkthrough — that's the duplication trap the v3 architecture was designed to eliminate.

   The `docs/walkthroughs/` root holds:
   - `package.json` (one shared install: `@slidev/cli`, `@slidev/theme-seriph`, `vue`; **generic** `dev` / `build` / `list` scripts — adding a new walkthrough requires **no script change**)
   - `bin/walkthrough.mjs` (generic dispatcher — auto-detects walkthroughs by `<slug>/slides.md`)
   - `_addon/` (the shared Slidev addon — see "Bootstrapping `_addon/`" below)
   - `node_modules/` (one shared install)

   Adding a brand-new walkthrough is then literally `mkdir docs/walkthroughs/<slug>` + write `slides.md` + write `README.md` — no further config changes needed. Preview with `npm run dev <slug>`.

5. Copy reusable assets from `assets/templates/` into the output folder, then adapt only the walkthrough-specific content.

6. Keep the generated artifact explicit about provenance:
   - Link `sourceDesign` and `sourcePlan` near the top of `slides.md` and `README.md`.
   - Mark `status` as `generated-derivative`.
   - Include `lastRegenerated` with the current date.

7. Produce 8-15 slides for normal design docs:
   - Title and source boundary.
   - Problem and user/stakeholder impact.
   - Scope and non-goals.
   - Current architecture or flow.
   - Proposed architecture or flow.
   - Data/API/schema details when relevant.
   - Phase-aware implementation view.
   - Risks, verification, and next steps.
   - Split dense diagrams or lists into multiple slides instead of shrinking them until unreadable.

8. Add narration to every substantive slide:
   - Narrator persona is fixed: you are a senior engineer on this project briefing the architect on this technical decision. The listener is experienced, will challenge you, and must understand the decision after listening alone. Full rules in `references/narration-style.md`.
   - **Language**: write narration in the language the user used in their request (Traditional Chinese, English, etc.). The persona, structure, and style rules apply regardless of language. CSS utility color tokens (`amber`, `sky`, `slate`, `rose`) are code identifiers — translate them into the narration language when speaking aloud (e.g. `amber` → 琥珀色 in Chinese; keep `amber` in English). Technical identifiers that have no natural-language equivalent (`guidedInput`, `QuizGuideSource`) stay in their original form in all languages.
   - Write narration in first person — e.g. "We decided…" / "我們決定…", "The risk I'm taking…" / "我承擔的風險是…" — decision-first, anticipating the architect's likely pushback.
   - **Use stage direction**: real briefings point at the slide — "the left column", "this middle box", "I marked this amber because…", "look at that risk on the right" — these make narration sound live, not pre-recorded. Every stage-direction phrase must be paired with a decision / tradeoff / risk in the next sentence; otherwise it's caption recap.
   - **Bind stage direction to live spotlight**: every directional phrase that points at a real element on the slide MUST be wrapped in `[h:anchor-id]…[/h]` markup, and the element MUST carry `data-walkthrough-anchor="anchor-id"`. useTTSPlayback engine parses the markup, drops it before TTS speaks, and rings the anchored DOM element while that caption cue is active. Multiple anchors: `[h:id-a,id-b]…[/h]`. Without the markup, narration says "the right column" but the slide does not light up — that breaks the brief-on-air illusion.
   - Forbidden tones: pure caption recap ("as shown on the slide…"), meta about the artifact ("this walkthrough is…"), second-person ("for the reviewer…"), and flat bullet-readout.
   - Use Slidev speaker notes in an HTML comment.
   - Also place a `<NarrationCue :text="\`...\`" />` on the slide. This invisible component registers the slide's narration into the shared stack so the single useTTSPlayback engine (mounted via `global-bottom.vue`) can read it when the slide is active. **Do not** put per-slide `<TTSPlayer>` instances — there is no per-slide player; navigation between slides automatically stops the previous narration and lets the user press Listen for the new one.
   - If you revise one, revise the other in the same edit. Never let two slides share identical narration; if two slides genuinely need the same point, merge them.

9. Preview before calling the walkthrough usable:
   - Dependencies are managed once at `docs/walkthroughs/` root (NOT per walkthrough). If `docs/walkthroughs/node_modules/` is missing, run `npm install` there. If `docs/walkthroughs/package.json` itself is missing, the addon-based infrastructure hasn't been bootstrapped yet — see "Bootstrapping `_addon/`" below.
   - Discover the slug list any time with `cd docs/walkthroughs && npm run list`.
   - **Run `npm run validate <slug>` BEFORE starting the dev server.** Structural lint catches: (M1) Mermaid node label containing unescaped `[]` / `{}` / `()` — Mermaid's parser confuses nested brackets with nested nodes and silently throws a parse-error overlay on the broken slide instead of the whole deck; (F0–F2) frontmatter without `addons: [./_addon]` or using the wrong relative path `../_addon`; (N1) deprecated `<TTSPlayer>` / `<GlobalTTSPlayer>` left over from v1/v2 templates. The lint is the difference between "agent ships a broken slide they never saw" and "agent catches it before user reports". Exit non-zero → fix every issue before continuing.
   - Local preview always uses `npm run dev <slug>` from `docs/walkthroughs/` (Slidev dev server reads `slides.md` directly); never depend on `dist/` for review.

     ```bash
     cd docs/walkthroughs
     npm run dev 2026-05-20-ai-quiz-curriculum-guided          # default port 3030
     npm run dev 2026-05-20-ai-quiz-curriculum-guided -- --port 4000   # extra flags passed through
     ```

   - In Claude Code: add an entry to `.claude/launch.json` with `runtimeArgs: ["run", "dev", "--prefix", "docs/walkthroughs", "--", "<slug>"]` and `port: 3030`. The `--` separator is **required** so npm passes `<slug>` through to the dispatcher script. Start it via `preview_start`, then inspect with `preview_snapshot` / `preview_screenshot`.
   - In Codex: `cd docs/walkthroughs && npm run dev <slug>` and open `http://127.0.0.1:3030` with the in-app browser when available; stop the server when done.
   - Check at least the title slide, one Mermaid slide, one phase slide, and the TTS controls (Listen / CC / Voice buttons inside Slidev's bottom-left nav). For every Mermaid slide, **navigate to it and confirm the diagram actually rendered** (Slidev shows a red error overlay if it didn't); validator catches structural patterns but only the live render confirms semantic correctness.
   - If no browser tool is available, run `npm run build <slug>` as a compile smoke test, then delete the produced `<slug>/dist/` (it is gitignored build output; never commit it) and report that visual preview was not performed.

10. Handle walkthrough feedback as generator feedback:
   - If the issue is systematic output quality, update this skill or its references first.
   - Then regenerate the affected walkthrough artifact from the canonical source docs.
   - Do not treat `docs/walkthroughs/*/slides.md` as a canonical hand-authored document.
   - In the response, state which skill rule changed and which generated artifact was regenerated.

## Output Rules

- Default Slidev theme: `@slidev/theme-seriph`. It carries a editorial / RFC feel that matches an engineer-to-architect briefing better than `default`. Use another theme only when the user explicitly asks, and document the reason in the walkthrough README.
- Treat `docs/design` and `docs/plans` as canonical. Treat `docs/walkthroughs` as reviewable derivative output.
- Do not hide important decisions inside narration only. Slides should remain readable without audio.
- Do not narrate code blocks, full table rows, full SQL, or field-by-field schemas. Summarize what matters.
- Prefer Mermaid for ER diagrams, flowcharts, and sequence diagrams. If the source doc lacks Mermaid, create a compact diagram in the walkthrough and consider suggesting a source-doc follow-up.
- Every diagram, screenshot, image, and generated visual must fit within the visible slide frame at desktop preview size. If it does not fit, redesign the slide: split it, summarize it, or replace the diagram with compact cards.
- A slide can fit physically and still fail. Avoid low-information layouts such as a long thin flow line with most of the slide empty. Regenerate those as cards, compact tables, or split slides with clearer review value.
- TTS controls are **integrated into Slidev's native nav bar** via `_addon/components/TTSNavButtons.vue`, which uses Vue `<Teleport>` at runtime to physically insert the Listen/Pause/Stop/CC/Voice buttons into Slidev's own bottom-nav `<nav class="flex flex-col">` DOM container. The buttons carry `.slidev-icon-btn` class to inherit Slidev's button styling. (Slidev does NOT auto-pick up `components/NavControls.vue` from user dirs — overriding NavControls that way doesn't work; Teleport is the workable approach.)
- Playback state lives in `_addon/composables/useTTSPlayback.ts` so both TTSNavButtons (controls) and GlobalCaptions (window) read the same speech / cue / spotlight state. Captions render via `_addon/global-bottom.vue` → `<GlobalCaptions />`.
- Navigating to another slide MUST auto-stop the previous slide's narration and clear its spotlight. Implementation: each `NarrationCue` registers `(slidePage, text)` keyed by Slidev's `useSlideContext().$page`; `useNarration().currentNarration` returns `narrationMap[useNav().currentSlideNo]`. `useTTSPlayback` watches `currentNarration` and calls `stop()` whenever it changes. **Do NOT** stack-track narration — Slidev pre-mounts neighbor slides during transitions, so a stack would return whichever cue happened to mount last instead of the visible slide's.
- Captions use a **3-line lyrics-style window** (previous dim, current bright with active-token highlight, next dim), glass background, bottom-center, smooth `transform: translateY` scroll between cues. Cues are chunked by punctuation with a 26–36 char target so each line reads in roughly 4–6 seconds. When browser boundary events are unavailable (Safari ≤ 16, some Linux engines), the player must fall back to a time-based progress timer (≈180 ms / char) so captions still scroll.
- Captions and slide spotlight share the same cue advancement. As the current cue changes, anchors named via `[h:id]` markup get a `.walkthrough-spotlight` class applied to matching `[data-walkthrough-anchor]` DOM elements; the spotlight is released when the cue advances away. Spotlight visual is `ring + scale(1.025) + brightness boost`, ring color inherits the element's `--spotlight-color` (defined in `style.css`) so amber cards glow amber, sky cards glow sky, slate cards glow slate.
- Spotlight DOM queries must filter to visible elements only (zero-size rects skipped) — Slidev pre-mounts neighbor slides during transitions, so an anchor id can match multiple instances; only the rendered one should light up.
- Use phase-aware language and visuals when the source distinguishes existing/current/future work:
  - Past or existing: gray.
  - Current PR or current implementation: blue.
  - Future or optional extension: amber.
- Keep output portable and local-preview friendly. Do not add Slidev dependencies to unrelated `hero-*` packages.

## Templates

Two layers of templates:

### Per-walkthrough scaffolding (every new walkthrough)

Pre-flight check:

```bash
test -d docs/walkthroughs/_addon && echo "addon ready" || echo "need to bootstrap _addon first"
```

If the addon is ready, copy into `docs/walkthroughs/<slug>/`:

- `assets/templates/walkthrough/README.md.template` -> `README.md` (replace `{{slug}}` with the directory name; fill in title / sourceDesign / sourcePlan / lastRegenerated)
- `assets/templates/walkthrough/slides.md.template` -> `slides.md` as a starting skeleton, then write content from the canonical design + plan
- **`slides.md` frontmatter MUST contain `addons: [./_addon]`** (the `./` prefix matters — see step 4 note)

No npm-script changes needed in root `package.json` — the generic `npm run dev <slug>` dispatcher auto-detects new walkthroughs by scanning for `<slug>/slides.md`.

### Bootstrapping `_addon/` (one-time, only if it doesn't exist yet)

Required when initializing `docs/walkthroughs/` from scratch. **Skip entirely if `_addon/` already exists** — never re-copy these into existing walkthroughs, that's the v3 anti-pattern.

Copy into `docs/walkthroughs/_addon/` (preserve subdirectory layout):

- `assets/templates/_addon/components/GlobalCaptions.vue`
- `assets/templates/_addon/components/NarrationCue.vue`
- `assets/templates/_addon/components/TTSNavButtons.vue`
- `assets/templates/_addon/composables/useNarration.ts`
- `assets/templates/_addon/composables/useTTSPlayback.ts`
- `assets/templates/_addon/global-bottom.vue`
- `assets/templates/_addon/style.css`
- `assets/templates/_addon/package.json` (addon manifest)

Copy into `docs/walkthroughs/`:

- `assets/templates/root/package.json.template` -> `package.json` (Slidev deps + generic `dev` / `build` / `list` scripts wired to the dispatcher)
- `assets/templates/root/gitignore.template` -> `.gitignore` (gitignores node_modules, per-walkthrough dist/, package-lock.json)
- `assets/templates/root/bin/walkthrough.mjs` -> `bin/walkthrough.mjs` (**the dispatcher — omitting this breaks `npm run dev/build/list` entirely**)

Then install Slidev once:

```bash
cd docs/walkthroughs
npm install
```

Verify the dispatcher works:

```bash
npm run list   # should print "No walkthroughs found" until you create one
```

## Recording Mode

Autoplay turns a walkthrough into a self-running screencast: narration plays, slides
auto-advance when each narration finishes, captions and spotlight track along. Combine
with a screen recorder to produce an MP4 demo.

### Activating autoplay

Two ways:

1. **URL query param** (recommended for recording sessions):
   `http://localhost:3030/1?play=1` — autoplay flag is read on page load.

2. **AUTO button in the nav bar** — toggles autoplay at runtime. The Listen button
   icon switches to `⏵⏵` when autoplay is armed.

Browser autoplay restrictions block speech without a user gesture, so the user must
**click Listen once** to start. After that, the gesture chain stays valid: narration
plays → ends → Slidev advances to next slide → new narration auto-speaks → repeat.

When the last slide's narration ends:

- `useTTSPlayback.markWalkthroughComplete()` flips `walkthroughComplete = true`.
- GlobalCaptions renders an `End of walkthrough` banner (~4.5s fade) and a hidden
  `<div class="walkthrough-complete">` marker — the latter is purely a DOM signal
  for headless recording tools (e.g. Playwright `page.waitForSelector('.walkthrough-complete')`).
- Autoplay flag is cleared so subsequent Listen clicks don't auto-advance.

### Recording on Mac (manual, recommended)

1. Install BlackHole once: `brew install blackhole-2ch`.
2. macOS → System Settings → Sound → set output to a Multi-Output Device that
   routes to BOTH the built-in speakers (so you hear it) AND BlackHole (so the
   recorder sees it).
3. Open QuickTime → New Screen Recording → Options → Microphone: **BlackHole 2ch**.
4. Open `http://localhost:3030/1?play=1`, start recording, click Listen once.
5. Walk away — the deck auto-advances to the end. Stop recording when the End-of-
   walkthrough banner shows. Crop the leading/trailing parts in QuickTime if needed.

Alternatively, OBS Studio with a Browser Source pointing at the same URL captures
both visuals and Desktop Audio in one step.

### Animations captured automatically

All Slidev / Vue visual transitions are pure CSS animations driven by `transform`,
`opacity`, etc., so screen recording captures them faithfully without extra config:

- Slide transitions (`transition: slide-left` in frontmatter).
- Caption 3-line `translateY` scroll + active-token gold highlight.
- Spotlight ring + scale + brightness boost on `[data-walkthrough-anchor]` elements.
- Mermaid SVG diagrams (static SVG, captured as part of the slide).

### Headless rendering (not implemented yet — future work)

Playwright + virtual audio device → fully unattended MP4 generation is feasible but
not implemented. The `walkthrough-complete` DOM marker is the synchronization point
when someone wants to build that pipeline.

---

This skill is experimental. Prefer improving the produced walkthrough and this skill from real use over adding generic options.
