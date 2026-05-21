# Narrated Design Walkthrough — Skill

## 這個目錄是什麼 / What's in this directory

這個目錄是 `narrated-design-walkthrough` skill 的完整實作，透過 Claude Code 或 Codex 的 plugin 系統載入後即可使用。

This directory contains the complete implementation of the `narrated-design-walkthrough` skill, loaded via the Claude Code or Codex plugin system.

## 用途 / Purpose

將 `docs/design/*.md` 與 `docs/plans/*.md` 轉換為音訊優先的 Slidev 簡報。每張 slide 包含：

Converts `docs/design/*.md` and `docs/plans/*.md` into audio-first Slidev presentations. Each slide includes:

- 逐段 TTS 旁白，以「工程師向架構師簡報」的語氣撰寫。/ Per-slide TTS narration written in an engineer-to-architect briefing tone.
- 聚光燈錨點（spotlight anchor）：旁白指向特定元素時畫面同步高亮。/ Spotlight anchors: on-slide elements light up in sync with narration cues.
- 自動播放引擎：最後一張 slide 旁白結束後自動完成整個 walkthrough。/ Autoplay engine: auto-advances through all slides and narration to the end.

## 觸發方式 / How to invoke

在 Claude Code 或 Codex 對話中直接呼叫技能：

Invoke the skill in a Claude Code or Codex session:

```
/narrated-design-walkthrough
```

或以自然語言描述需求：

Or describe the task in natural language:

> 請用 narrated-design-walkthrough 幫我把 `docs/design/my-feature.md` 產成 walkthrough。
>
> Generate a narrated walkthrough from `docs/design/my-feature.md` using narrated-design-walkthrough.

輸出語言會自動跟隨你使用的語言（繁體中文、英文等）。

Output language automatically matches the language of your request (Traditional Chinese, English, etc.).

## 目錄結構 / Directory structure

```
narrated-design-walkthrough/
├── SKILL.md                          ← skill 指令（由 Claude / Codex 載入）
│                                       skill instructions (loaded by Claude / Codex)
├── agents/
│   └── openai.yaml                   ← OpenAI agent 設定 / OpenAI agent config
├── references/
│   ├── narration-style.md            ← 工程師對架構師旁白規則
│   │                                   engineer-to-architect narration rules
│   └── slidev-layout.md              ← slide 排版、Mermaid 與聚光燈規則
│                                       slide layout, Mermaid, and spotlight rules
└── assets/templates/                 ← skill 產出時複製的 bootstrap 範本
                                        bootstrap templates copied during generation
    ├── _addon/                        ← Slidev addon：TTS 引擎、字幕、聚光燈
    │                                   Slidev addon: TTS engine, captions, spotlight
    │   ├── components/                ← GlobalCaptions, NarrationCue, TTSNavButtons
    │   ├── composables/               ← useNarration, useTTSPlayback
    │   ├── global-bottom.vue
    │   ├── package.json
    │   └── style.css
    ├── root/                          ← docs/walkthroughs/ 根目錄 bootstrap 用
    │                                   bootstrapping for docs/walkthroughs/ root
    │   ├── bin/walkthrough.mjs        ← dev/build/list/validate 統一調度器
    │   │                               unified dev/build/list/validate dispatcher
    │   ├── gitignore.template
    │   └── package.json.template
    └── walkthrough/                   ← 每個 walkthrough 的起始骨架
                                        per-walkthrough starting scaffold
        ├── slides.md.template
        └── README.md.template
```

## 延伸閱讀 / See also

- [Top-level README](../../README.md) — 安裝方式、完整範例、update 指令 / install, full example, update commands
- [SKILL.md](SKILL.md) — skill 完整工作流程與規則（供 Claude / Codex 讀取）/ full workflow and rules (read by Claude / Codex)
- [Live demo](https://gmliao.github.io/narrated-design-walkthrough-example/) — 以本 skill 為 source 自動生成的 walkthrough 示範
