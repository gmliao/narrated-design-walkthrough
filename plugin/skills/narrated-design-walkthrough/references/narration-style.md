# Narration Style

Use this reference when creating or revising narration for narrated design walkthroughs.

## Persona (non-negotiable)

Narration is not slide commentary, nor a voice-over for a written explanation. Every narration segment must be written from this persona:

> **You are a senior engineer on this project, briefing the architect on a technical decision.**
> The listener is experienced, patient, and will challenge you. Your goal: they walk away understanding why the decision was made, where it could fail, and where you've already handled the risk.

Specific requirements:

- **First person, singular and plural**: use "we" for team/design decisions, "I" for your own position or recommendation. Avoid the observer voice ("this design will…", "for the reviewer…").
- **Decision first**: lead with "We decided X" / "We are not doing Y", then give the background and reasoning. Don't describe the current state first and build up to the decision.
- **Anticipate challenges**: proactively answer the question the architect will ask. "Someone will ask why we didn't use an enum — because…" "This choice looks conservative, but our judgment is…"
- **Own the risks**: name the risks you see, and say how you plan to contain them. Don't hand risks to the listener to figure out.
- **Familiarity**: you've lived with this design. The narration should carry the confidence of "I've already thought about this", not reading from a script.

## Language Adaptation

Write narration in the same language the user used in their request. If the request is in Traditional Chinese, use Traditional Chinese throughout; if in English, use English. The persona, structure, and style rules apply regardless of language.

**CSS utility color tokens** (e.g. Tailwind's `amber`, `sky`, `slate`, `rose`) are code identifiers, not speech words. Translate them into the narration language:

| Tailwind token | Traditional Chinese | English |
|---|---|---|
| `amber` | 琥珀色 | amber |
| `sky` | 天藍色 | sky blue |
| `slate` | 灰藍色 | slate |
| `rose` | 玫瑰色 | rose |

Technical identifiers that have no natural-language equivalent (`guidedInput`, `QuizGuideSource`, `border-amber-400`) stay in their original form in all languages.

Stage direction examples in Traditional Chinese: "左邊那欄" / "中間這個 box" / "我用琥珀色標的是因為…"
Stage direction examples in English: "the left column" / "this middle box" / "I marked this amber because…"

## What To Say

- Lead with the decision or conclusion for this slide, then expand on the reasoning.
- Explain why this boundary was chosen, not another, and acknowledge the appeal of alternatives.
- Translate schema, tables, and fields into "who owns the data, what breaks, who needs to re-run if it changes."
- At non-goals, explain *why this is not done now*, not just "this is out of scope."
- At verification/testing slides, say "this means if something goes wrong, we'll catch it at this stage," not just "we'll have tests."

## What Not To Say

- Don't read the slide text aloud. The slide is visible; narration adds the judgment that can't be seen.
- Don't use "as shown on the slide" / "as mentioned above" — pure caption recap, no new information added.
- Don't use "for the reviewer…" / "this walkthrough is…" — that's meta commentary; it belongs in the README, not the narration.
- Don't enumerate all bullets. Collect them into a trade-off, a claim, or a conclusion.
- Don't oversell. If the source design is still a draft, the narration should carry "we're leaning toward… but this part is still converging."

## Stage Direction + Spotlight Markup

Walkthrough narration **lights up**: every sentence that points at a real element on the slide must be wrapped in `[h:anchor-id]…[/h]` markup. The useTTSPlayback engine applies a ring + scale spotlight to matching `[data-walkthrough-anchor="anchor-id"]` DOM elements while that cue is active.

Syntax:

```
[h:card-llm]the amber LLM pipeline on the right[/h] — I marked it amber specifically to signal…
[h:card-teacher,card-api,card-llm]three boxes, left to right[/h], starting with…
```

- `[h:id]…[/h]`: single target
- `[h:id-a,id-b,id-c]…[/h]`: light up multiple targets simultaneously (comma-separated, no spaces)
- The matching element must carry `data-walkthrough-anchor="id"` (multiple ids space-separated per HTML convention)
- Text inside the markup is read aloud by TTS; the brackets and `h:` prefix are stripped before speech
- Cross-sentence markup within one cue is fine; the engine tracks by character position

**Anchor naming conventions** (see `slidev-layout.md`):

- Cards: `card-<role>`, e.g. `card-teacher`, `card-llm`, `card-prompt-authority`
- Table rows: `row-<key>`, e.g. `row-step2`
- Phase cards: `step-phase3b`
- Bullets: `bullet-<key>`, e.g. `bullet-payload-removed`
- Inline phrases: `span-<key>`, e.g. `span-xor`

**Stage direction without markup doesn't count**: if narration says "that column on the right" but the element has no anchor and the sentence has no markup, there is no spotlight effect — it's a spec violation, not a style choice. Add anchor + markup at the time of writing, not as a follow-up pass.

## Stage Direction (encouraged)

A real-room engineer points at the slide. Narration should carry that live quality. But every stage direction must be **anchored to a decision point** — never pure caption.

Encouraged:

- **Spatial**: "the left column" / "this middle box" / "top-right corner, that xor marker" / "the bottom three"
- **Contrast**: "compare it to the right side — you'll see…" / "vs. the previous slide, this version adds…"
- **Attention guidance**: "if you only look at one thing, look at this" / "I want your eye on this column"
- **Color / visual symbol decoding**: "I didn't pick amber randomly — it signals…" / "this dashed line is intentional — it means…"
- **Reading order hints**: "I suggest we go left to right" / "I'll start with the rightmost risk"

Self-check: every stage direction sentence must be immediately followed by a **why this is worth pointing at** — a decision, a trade-off, a risk, or an anticipated pushback. If the follow-up is just "that's what it is", it's a caption, not stage direction.

Example comparison:

- ❌ Caption: "Left is done, center is this sprint, right is future."
- ✅ Stage direction: "Left is already shipped, I won't dwell on it. I want your attention on the center column — that's the only thing moving this version. The amber column on the right is what we've deliberately held back — we'll open it once we see user feedback."
- ❌ Caption: "This table has four columns."
- ✅ Stage direction: "Out of these four columns, I'd like you to stop at the third one — that's the most likely misread."

## Sentence Shape

- Leave breathing room between sentences; TTS needs it. Target 30–45 characters per sentence in Chinese; in English, one clear clause per sentence.
- One idea per sentence. Connect complex reasoning with "but", "in other words", "which means" — don't pack sub-clauses.
- Keep each slide's narration to 90–150 Chinese characters (or ~80–120 English words); if you're over, the slide should probably be split.

## Phase Voice

When the walkthrough distinguishes phases:

- Already shipped: confident past tense — "We already wired X in…"
- This PR / current implementation: active present — "This version we're adding Y…"
- Future / optional extension: conditional — "If we ever need Z, we've already left the hook…"

Tone should carry the timeline, not just rely on color coding.

## Good Patterns (engineer-to-architect)

- "Our decision this version is X, primarily because Y — which also means we're not doing Z yet."
- "You'll ask why we didn't use an enum. Our reasoning: sourceKey is…, so we chose…"
- "This schema looks wide, but there are really only three things to remember: …. Everything else is derived."
- "The risk we're carrying is… and the way we're containing it is…"
- "The alternative was… We know its upside, but the cost is…, so we're holding off."
- "If the architecture evolves to…, this interface already leaves the extension point; it won't be a breaking change."
- **"This middle box is the only thing moving in this version — the two blocks above and below, I haven't touched — that's the zero-regression guarantee."** (stage direction + decision)
- **"You see that amber column on the right — I left it there deliberately because…"** (color decode + trade-off)
- **"Out of these four columns, I'd like you to stop at the third — that's the most likely misread."** (attention guidance + anticipated pushback)

## Anti-Patterns

- "First point…, second point…, third point…" — bullet narration. Collapse them into a conclusion.
- Reading a table like a shopping list.
- Using "extensible" / "more flexible" as abstractions that hide trade-offs.
- Narrating future features in present tense, making the architect think they're already shipped.
- Meta narration: talking about the walkthrough itself.
- Second person: "for the reviewer…", "everyone please note…" — lecture-style.

## Self-Check (run through after writing narration)

1. If I were saying this face-to-face to the architect, would this sound too formal or too passive? If yes, switch to active assertion.
2. If the listener only heard this, without seeing the slide, would they know what decision I made? If not, move the decision sentence first.
3. Did I own a risk and say how I'm containing it in this segment? If completely absent, add one sentence.
4. Is there at least one stage direction (pointing at a column / box / color / row)? If none, add one — but every direction must be followed by why it's worth pointing at, not just a label.
5. Does every stage direction sentence have `[h:anchor]…[/h]` markup, and does the matching element have `data-walkthrough-anchor`? If the text points without the spotlight wiring, that's a spec gap.
