# narrated-design-walkthrough

[English](README.md)

將專案的 canonical 設計文件（`docs/design/*.md`、`docs/plans/*.md`）轉換為音訊優先的 Slidev walkthrough，每張 slide 含 TTS 旁白、聚光燈錨點與內建播放引擎。

## 實際效果

→ **[Live demo](https://gmliao.github.io/narrated-design-walkthrough-example/)** — 以本 skill 自身的 v3 架構為 source，由 skill 自動生成的 walkthrough。

→ **[Demo repo](https://github.com/gmliao/narrated-design-walkthrough-example)** — 完整呈現 `claude plugin marketplace add` + `claude plugin install` + `/narrated-design-walkthrough` 的輸出成果。

## 功能

- 讀取現有的 design/plan Markdown — 從不修改 source docs。
- 生成 `docs/walkthroughs/<slug>/slides.md`，包含每張 slide 的 `<NarrationCue>`、`data-walkthrough-anchor` 聚光燈接線，以及 `_addon` 播放控制。
- 旁白採用「工程師向架構師簡報」的語氣：結論先行、自行承擔風險、stage direction 錨定 DOM 元素。
- 輸出語言自動跟隨你的請求語言（繁體中文、英文等）。

## 安裝

### Codex

需要支援 plugin marketplace 的 Codex CLI 版本，先確認：

```bash
codex plugin marketplace add --help
```

將本 repo 加為 Codex plugin marketplace：

```bash
codex plugin marketplace add gmliao/narrated-design-walkthrough
```

接著從 Codex 安裝：

1. 執行 `codex` 啟動 Codex。
2. 輸入 `/plugins` 開啟 plugin 瀏覽器。
3. 切換到 **Narrated Design Walkthrough** marketplace。
4. 開啟 **Narrated Design Walkthrough** 並選擇 **Install plugin**。
5. 開新的 Codex thread。

然後直接描述需求即可觸發 skill：

> 請用 `narrated-design-walkthrough` 幫我從 `docs/design/my-feature-design.md` 生成 narrated walkthrough。

也可以在 Codex 中輸入 `@` 並選擇 plugin 或 bundled skill 來強制使用此流程。

如果舊文件出現 `codex plugins install ...`，請忽略 — Codex 現在從 `/plugins` 瀏覽器安裝 plugin。

已加過 marketplace 的隊友在有更新時，先 refresh：

```bash
codex plugin marketplace upgrade narrated-design-walkthrough
```

若目前的 Codex 版本沒有 `/plugins` 瀏覽器，在加完 marketplace 後可手動在 `~/.codex/config.toml` 加入：

```toml
[plugins."narrated-design-walkthrough@narrated-design-walkthrough"]
enabled = true
```

若 macOS 將 `codex` 擋為惡意軟體，檢查是否有舊的全域 binary 覆蓋了現在的安裝：

```bash
which -a codex
codex --version
```

移除或調整路徑順序，再透過正常管道重新安裝或更新 Codex（`npm install -g @openai/codex@latest`、Homebrew 或 Codex app）。

### Claude Code

```bash
claude plugin marketplace add gmliao/narrated-design-walkthrough
claude plugin install narrated-design-walkthrough
```

在 session 中呼叫：

```
/narrated-design-walkthrough
```

### 手動安裝（複製進專案）

將 `skills/narrated-design-walkthrough/` 複製到專案的 `.codex/skills/`（Codex）或 Claude Code skills 目錄，再在 session 中使用 `/narrated-design-walkthrough`。

## 更新

```bash
# Claude Code
claude plugins update narrated-design-walkthrough

# Codex
codex plugin marketplace upgrade narrated-design-walkthrough
```

升級 marketplace 後，重啟 Codex 並視需要從 `/plugins` 重新安裝或啟用 plugin。

## 使用方式

指定一份設計文件：

> "請幫我從 docs/design/2026-05-20-ai-quiz-curriculum-guided-design.md 生成 narrated walkthrough"

skill 會：

1. 讀取設計文件（若有對應的 plan 也一起讀入）。
2. 將設計分類為 `schema-heavy`、`process-heavy` 或 `hybrid`。
3. 以你的語言起草每張 slide 的旁白。
4. 寫入 `docs/walkthroughs/<slug>/slides.md` 與 `README.md`。
5. 若 `docs/walkthroughs/` 尚未初始化，自動 bootstrap `_addon` 播放引擎。

預覽：

```bash
cd docs/walkthroughs
npm install          # 只需執行一次
npm run dev <slug>   # 在 http://localhost:3030 開啟
```

## Skill 結構

```
.agents/plugins/marketplace.json       ← Codex marketplace entry
.codex-plugin/plugin.json              ← Codex plugin manifest
skills/
└── narrated-design-walkthrough/
    ├── SKILL.md                      ← skill 指令（由 Claude / Codex 載入）
    ├── agents/openai.yaml            ← OpenAI agent 設定
    ├── references/
    │   ├── narration-style.md        ← 工程師對架構師旁白規則
    │   └── slidev-layout.md          ← slide 排版、圖表與聚光燈規則
    └── assets/templates/
        ├── _addon/                   ← Slidev addon：TTS 引擎、字幕、聚光燈
        │   ├── components/           ← GlobalCaptions, NarrationCue, TTSNavButtons
        │   ├── composables/          ← useNarration, useTTSPlayback
        │   ├── global-bottom.vue
        │   ├── package.json
        │   └── style.css
        ├── root/
        │   ├── bin/walkthrough.mjs   ← dev/build/list/validate 統一調度器
        │   ├── gitignore.template
        │   └── package.json.template
        └── walkthrough/
            ├── slides.md.template
            └── README.md.template
```

## 授權

MIT
